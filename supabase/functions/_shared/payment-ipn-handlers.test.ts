import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { handleMomoIpn, handleZaloPayCallback } from './payment-ipn-handlers.ts'
import { loadPaymentConfig } from './payment-config.ts'
import { CFG, fakeDb, MOMO_IPN, post, REF, ZALO_DATA, ZALO_MAC } from './payment-test-fixtures.ts'

const MOMO_URL = 'https://x/functions/v1/payment-ipn-momo'
const ZALO_URL = 'https://x/functions/v1/payment-ipn-zalopay'
const fulfillWith = (result: string) => fakeDb({ fulfill_order: () => ({ data: result, error: null }) })
const rpcNames = (db: { calls: { fn: string }[] }) => db.calls.map((c) => c.fn)

// ---------------- MoMo ----------------
Deno.test('MoMo IPN: chữ ký sai -> 400 và KHÔNG gọi DB', async () => {
  const db = fakeDb()
  const res = await handleMomoIpn(post(MOMO_URL, { ...MOMO_IPN, amount: 1 }), { db, cfg: CFG })
  assertEquals(res.status, 400)
  assertEquals(await res.text(), '')
  assertEquals(db.calls.length, 0)
})

Deno.test('MoMo IPN: body rỗng / không phải JSON / mảng / thiếu chữ ký -> 400, không gọi DB', async () => {
  const db = fakeDb()
  for (const body of ['', 'abc', '[]', 'null', '{}']) {
    assertEquals((await handleMomoIpn(post(MOMO_URL, body), { db, cfg: CFG })).status, 400, body)
  }
  assertEquals(db.calls.length, 0)
})

Deno.test('MoMo IPN: body quá lớn -> 413 trước khi parse', async () => {
  const db = fakeDb()
  assertEquals((await handleMomoIpn(post(MOMO_URL, 'x'.repeat(20_000)), { db, cfg: CFG })).status, 413)
  assertEquals(db.calls.length, 0)
})

Deno.test('MoMo IPN: hợp lệ -> fulfill_order đúng tham số (amount từ IPN, so với DB ở SQL) + log, 204', async () => {
  const db = fulfillWith('paid')
  const res = await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: CFG })
  assertEquals(res.status, 204)
  assertEquals(db.calls[0], { fn: 'fulfill_order', params: { p_provider: 'momo', p_order_ref: REF, p_provider_tx_id: '4000000001', p_amount: 50000 } })
  assertEquals(rpcNames(db), ['fulfill_order', 'log_payment_event'])
})

Deno.test('MoMo IPN: payload ghi log không chứa chữ ký', async () => {
  const db = fulfillWith('paid')
  await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: CFG })
  const payload = db.calls[1].params!.p_payload as Record<string, unknown>
  assert(!('signature' in payload))
  assertEquals(payload.orderId, REF)
})

Deno.test('MoMo IPN: duplicate / mismatch / unknown_order đều được ghi nhận -> 204 (MoMo không gọi lại)', async () => {
  for (const r of ['duplicate', 'mismatch', 'unknown_order']) {
    const db = fulfillWith(r)
    assertEquals((await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: CFG })).status, 204, r)
    assertEquals(db.calls[1].params!.p_result, r)
  }
})

Deno.test('MoMo IPN: resultCode khác 0 (chữ ký đúng) -> fail_payment_order, không fulfill', async () => {
  // printf %s "accessKey=AK123&amount=50000&extraData=&message=Cancelled&orderId=...&resultCode=1006&transId=0" | openssl dgst -sha256 -hmac SK456
  const failed = { ...MOMO_IPN, resultCode: 1006, message: 'Cancelled', transId: 0,
    signature: '' }
  failed.signature = await (await import('./payment-hmac.ts')).hmacSha256Hex('SK456',
    `accessKey=AK123&amount=50000&extraData=&message=Cancelled&orderId=${REF}&orderInfo=Nap 500 credit&orderType=momo_wallet&partnerCode=MOMOTEST&payType=qr&requestId=${REF}&responseTime=1761900000000&resultCode=1006&transId=0`)
  const db = fakeDb()
  assertEquals((await handleMomoIpn(post(MOMO_URL, failed), { db, cfg: CFG })).status, 204)
  assertEquals(rpcNames(db), ['fail_payment_order', 'log_payment_event'])
})

Deno.test('MoMo IPN: lỗi DB -> 500 để MoMo gọi lại', async () => {
  const db = fakeDb({ fulfill_order: () => ({ data: null, error: { message: 'boom' } }) })
  assertEquals((await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: CFG })).status, 500)
})

Deno.test('MoMo IPN: ví MoMo tắt -> 503, không gọi DB; GET -> 405', async () => {
  const db = fakeDb()
  assertEquals((await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: { ...CFG, momo: undefined } })).status, 503)
  assertEquals((await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg: null })).status, 503)
  assertEquals((await handleMomoIpn(new Request(MOMO_URL), { db, cfg: CFG })).status, 405)
  assertEquals(db.calls.length, 0)
})

Deno.test('MoMo IPN: production + key sandbox công khai -> cấu hình tắt -> 503 dù chữ ký đúng', async () => {
  const env: Record<string, string> = {
    PAYMENT_ENV: 'production', PAYMENT_RETURN_URL: 'https://app.example.com/r', SUPABASE_URL: 'https://x.supabase.co',
    MOMO_PARTNER_CODE: 'MOMO', MOMO_ACCESS_KEY: 'F8BBA842ECF85', MOMO_SECRET_KEY: 'SK456',
  }
  const cfg = loadPaymentConfig((k) => env[k], () => {})
  const db = fakeDb()
  assertEquals((await handleMomoIpn(post(MOMO_URL, MOMO_IPN), { db, cfg })).status, 503)
  assertEquals(db.calls.length, 0)
})

// ---------------- ZaloPay ----------------
const zaloBody = (over: Record<string, unknown> = {}) => ({ data: ZALO_DATA, mac: ZALO_MAC, type: 1, ...over })

Deno.test('ZaloPay callback: MAC sai -> return_code -1 và KHÔNG gọi DB', async () => {
  const db = fakeDb()
  const res = await handleZaloPayCallback(post(ZALO_URL, zaloBody({ data: ZALO_DATA.replace('50000', '1') })), { db, cfg: CFG })
  assertEquals((await res.json()).return_code, -1)
  assertEquals(db.calls.length, 0)
})

Deno.test('ZaloPay callback: body rác -> -1, không gọi DB', async () => {
  const db = fakeDb()
  for (const body of ['', 'abc', '{}', JSON.stringify({ data: 1, mac: 2 })]) {
    assertEquals((await (await handleZaloPayCallback(post(ZALO_URL, body), { db, cfg: CFG })).json()).return_code, -1, body)
  }
  assertEquals(db.calls.length, 0)
})

Deno.test('ZaloPay callback: hợp lệ -> fulfill_order, return_code 1', async () => {
  const db = fulfillWith('paid')
  const res = await handleZaloPayCallback(post(ZALO_URL, zaloBody()), { db, cfg: CFG })
  assertEquals(await res.json(), { return_code: 1, return_message: 'success' })
  assertEquals(db.calls[0], { fn: 'fulfill_order', params: { p_provider: 'zalopay', p_order_ref: REF, p_provider_tx_id: '240000000001', p_amount: 50000 } })
})

Deno.test('ZaloPay callback: duplicate / mismatch -> vẫn return_code 1 (không gọi lại)', async () => {
  for (const r of ['duplicate', 'mismatch']) {
    const res = await handleZaloPayCallback(post(ZALO_URL, zaloBody()), { db: fulfillWith(r), cfg: CFG })
    assertEquals((await res.json()).return_code, 1, r)
  }
})

Deno.test('ZaloPay callback: lỗi DB -> return_code 0 (ZaloPay gọi lại)', async () => {
  const db = fakeDb({ fulfill_order: () => ({ data: null, error: { message: 'boom' } }) })
  assertEquals((await (await handleZaloPayCallback(post(ZALO_URL, zaloBody()), { db, cfg: CFG })).json()).return_code, 0)
})

Deno.test('ZaloPay callback: ví tắt -> 503, không gọi DB', async () => {
  const db = fakeDb()
  assertEquals((await handleZaloPayCallback(post(ZALO_URL, zaloBody()), { db, cfg: { ...CFG, zalopay: undefined } })).status, 503)
  assertEquals(db.calls.length, 0)
})
