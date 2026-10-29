import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { handleCreatePayment, MIN_REFRESH_GAP_MS, type CreateDeps } from './payment-create-handler.ts'
import { CFG, fakeDb, ORDER_ID, orderRow, post, REF, USER_ID } from './payment-test-fixtures.ts'
import type { FetchFn } from './payment-types.ts'

const URL_ = 'https://x/functions/v1/create-payment'
const NOW = Date.parse('2026-10-31T10:05:00Z')
const okFetch = (json: unknown): FetchFn & { calls: { url: string; init: RequestInit }[] } => {
  const calls: { url: string; init: RequestInit }[] = []
  const f = ((url: string, init: RequestInit) => { calls.push({ url, init }); return Promise.resolve(new Response(JSON.stringify(json))) }) as FetchFn & { calls: typeof calls }
  f.calls = calls
  return f
}
const deps = (over: Partial<CreateDeps> = {}): CreateDeps => ({
  db: fakeDb({ create_payment_order: () => ({ data: orderRow(), error: null }) }), cfg: CFG, fetchFn: okFetch({ resultCode: 0, payUrl: 'https://pay.example/1' }),
  nowMs: () => NOW, authenticate: () => Promise.resolve(USER_ID), ...over,
})
const create = (provider: unknown, pkg: unknown = 'p50k') => post(URL_, { action: 'create', provider, package_id: pkg })

Deno.test('không JWT hợp lệ -> 401, không gọi DB', async () => {
  const d = deps({ authenticate: () => Promise.resolve(null) })
  assertEquals((await handleCreatePayment(create('momo'), d)).status, 401)
  assertEquals((d.db as ReturnType<typeof fakeDb>).calls.length, 0)
})

Deno.test('GET -> danh sách ví đang bật', async () => {
  assertEquals(await (await handleCreatePayment(new Request(URL_), deps())).json(), { providers: ['momo', 'zalopay'] })
  assertEquals(await (await handleCreatePayment(new Request(URL_), deps({ cfg: { ...CFG, zalopay: undefined } }))).json(), { providers: ['momo'] })
  assertEquals(await (await handleCreatePayment(new Request(URL_), deps({ cfg: null }))).json(), { providers: [] })
})

Deno.test('create: ví tắt -> 503 provider_disabled, không tạo đơn', async () => {
  const d = deps({ cfg: { ...CFG, momo: undefined } })
  const res = await handleCreatePayment(create('momo'), d)
  assertEquals(res.status, 503)
  assertEquals((await res.json()).error, 'provider_disabled')
  assertEquals((d.db as ReturnType<typeof fakeDb>).calls.length, 0)
})

Deno.test('create: provider/package sai kiểu -> 400', async () => {
  for (const [p, k] of [['paypal', 'p50k'], [1, 'p50k'], ['momo', 5], ['momo', 'x'.repeat(60)]]) {
    assertEquals((await handleCreatePayment(create(p, k), deps())).status, 400)
  }
})

Deno.test('create: user lấy từ JWT, KHÔNG từ body; trả order_id + pay_url; không gọi fulfill', async () => {
  const d = deps()
  const req = post(URL_, { action: 'create', provider: 'momo', package_id: 'p50k', user_id: 'ke-tan-cong', redirectUrl: 'https://evil.example' })
  const res = await handleCreatePayment(req, d)
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { order_id: ORDER_ID, pay_url: 'https://pay.example/1' })
  const calls = (d.db as ReturnType<typeof fakeDb>).calls
  assertEquals(calls[0], { fn: 'create_payment_order', params: { p_user: USER_ID, p_provider: 'momo', p_package_id: 'p50k' } })
  assert(!calls.some((c) => c.fn === 'fulfill_order'))
  // redirectUrl gửi cho MoMo là của server + id đơn, không phải URL client
  const sent = JSON.parse((d.fetchFn as ReturnType<typeof okFetch>).calls[0].init.body as string)
  assertEquals(sent.redirectUrl, `https://app.example.com/payment/return?order=${ORDER_ID}`)
})

Deno.test('create: lỗi RPC map đúng mã (đủ 5 đơn -> 429, khoá -> 403, gói lạ -> 404)', async () => {
  for (const [code, status] of [['22023', 429], ['42501', 403], ['P0002', 404], ['XX000', 500]] as const) {
    const d = deps({ db: fakeDb({ create_payment_order: () => ({ data: null, error: { message: 'm', code } }) }) })
    assertEquals((await handleCreatePayment(create('momo'), d)).status, status, code)
  }
})

Deno.test('create: provider từ chối / lỗi mạng -> fail_payment_order + 502', async () => {
  for (const fetchFn of [okFetch({ resultCode: 1001 }), (() => Promise.reject(new Error('net'))) as FetchFn]) {
    const d = deps({ fetchFn })
    const res = await handleCreatePayment(create('momo'), d)
    assertEquals(res.status, 502)
    assert((d.db as ReturnType<typeof fakeDb>).calls.some((c) => c.fn === 'fail_payment_order'))
  }
})

Deno.test('refresh: đơn người khác / không có -> 404 (RPC lọc theo user)', async () => {
  const d = deps({ db: fakeDb({ get_payment_order: () => ({ data: [], error: null }) }) })
  assertEquals((await handleCreatePayment(post(URL_, { action: 'refresh', order_id: ORDER_ID }), d)).status, 404)
  assertEquals((d.db as ReturnType<typeof fakeDb>).calls[0].params, { p_order: ORDER_ID, p_user: USER_ID })
  assertEquals((await handleCreatePayment(post(URL_, { action: 'refresh', order_id: 'not-uuid' }), d)).status, 400)
})

Deno.test('refresh: đã hỏi < 15s trước -> không hỏi provider', async () => {
  const recent = new Date(NOW - MIN_REFRESH_GAP_MS + 1000).toISOString()
  const f = okFetch({})
  const d = deps({ fetchFn: f, db: fakeDb({ get_payment_order: () => ({ data: [orderRow({ last_checked_at: recent })], error: null }) }) })
  assertEquals(await (await handleCreatePayment(post(URL_, { action: 'refresh', order_id: ORDER_ID }), d)).json(), { status: 'pending' })
  assertEquals(f.calls.length, 0)
})

Deno.test('refresh: pending + lâu chưa hỏi -> query provider, fulfill, trả status mới', async () => {
  let reads = 0
  const f = okFetch({ partnerCode: 'MOMOTEST', orderId: REF, resultCode: 0, transId: 4000000001, amount: 50000 })
  const db = fakeDb({
    get_payment_order: () => ({ data: [orderRow({ status: ++reads === 1 ? 'pending' : 'paid' })], error: null }),
    fulfill_order: () => ({ data: 'paid', error: null }),
  })
  const res = await handleCreatePayment(post(URL_, { action: 'refresh', order_id: ORDER_ID }), deps({ fetchFn: f, db }))
  assertEquals(await res.json(), { status: 'paid' })
  assertEquals(db.calls.map((c) => c.fn), ['get_payment_order', 'fulfill_order', 'log_payment_event', 'mark_order_checked', 'expire_stale_orders', 'get_payment_order'])
  assertEquals(f.calls[0].url, 'https://test-payment.momo.vn/v2/gateway/api/query')
})

Deno.test('refresh: provider lỗi mạng -> KHÔNG đánh dấu đã hỏi (không bị hết hạn nhầm)', async () => {
  const db = fakeDb({ get_payment_order: () => ({ data: [orderRow()], error: null }) })
  await handleCreatePayment(post(URL_, { action: 'refresh', order_id: ORDER_ID }), deps({ db, fetchFn: (() => Promise.reject(new Error('net'))) as FetchFn }))
  assert(!db.calls.some((c) => c.fn === 'mark_order_checked'))
})

Deno.test('refresh: đơn đã paid -> trả status, không hỏi provider', async () => {
  const f = okFetch({})
  const db = fakeDb({ get_payment_order: () => ({ data: [orderRow({ status: 'paid' })], error: null }) })
  assertEquals(await (await handleCreatePayment(post(URL_, { action: 'refresh', order_id: ORDER_ID }), deps({ db, fetchFn: f }))).json(), { status: 'paid' })
  assertEquals(f.calls.length, 0)
})
