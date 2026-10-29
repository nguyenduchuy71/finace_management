import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { handleReconcile, MIN_AGE_S, BATCH_LIMIT } from './payment-reconcile-handler.ts'
import { CFG, fakeDb, orderRow, REF } from './payment-test-fixtures.ts'
import type { FetchFn } from './payment-types.ts'

const call = (secret: string | null, method = 'POST') =>
  new Request('https://x/functions/v1/payment-reconcile', { method, headers: secret === null ? {} : { 'x-reconcile-secret': secret } })
const paidFetch: FetchFn = () => Promise.resolve(new Response(JSON.stringify({ partnerCode: 'MOMOTEST', orderId: REF, resultCode: 0, transId: 1, amount: 50000 })))

Deno.test('thiếu RECONCILE_SECRET -> 503; sai/thiếu header -> 401; GET -> 405 (không gọi DB)', async () => {
  const db = fakeDb()
  assertEquals((await handleReconcile(call('s'), { db, cfg: CFG, fetchFn: paidFetch, secret: undefined })).status, 503)
  assertEquals((await handleReconcile(call('sai'), { db, cfg: CFG, fetchFn: paidFetch, secret: 's' })).status, 401)
  assertEquals((await handleReconcile(call(null), { db, cfg: CFG, fetchFn: paidFetch, secret: 's' })).status, 401)
  assertEquals((await handleReconcile(call('s', 'GET'), { db, cfg: CFG, fetchFn: paidFetch, secret: 's' })).status, 405)
  assertEquals(db.calls.length, 0)
})

Deno.test('đúng secret: đối soát từng đơn pending rồi expire_stale_orders', async () => {
  const db = fakeDb({
    list_orders_to_reconcile: () => ({ data: [orderRow()], error: null }),
    fulfill_order: () => ({ data: 'paid', error: null }),
    expire_stale_orders: () => ({ data: 2, error: null }),
  })
  const res = await handleReconcile(call('s'), { db, cfg: CFG, fetchFn: paidFetch, secret: 's' })
  assertEquals(await res.json(), { checked: 1, results: { paid: 1 }, expired: 2 })
  assertEquals(db.calls[0], { fn: 'list_orders_to_reconcile', params: { p_min_age_s: MIN_AGE_S, p_limit: BATCH_LIMIT } })
  assertEquals(db.calls.at(-1)?.fn, 'expire_stale_orders')
})

Deno.test('lỗi DB khi liệt kê -> 500', async () => {
  const db = fakeDb({ list_orders_to_reconcile: () => ({ data: null, error: { message: 'x' } }) })
  assertEquals((await handleReconcile(call('s'), { db, cfg: CFG, fetchFn: paidFetch, secret: 's' })).status, 500)
})
