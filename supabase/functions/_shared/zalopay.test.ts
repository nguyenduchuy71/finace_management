import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { asCallbackBody, buildCreate, buildQuery, callbackOutcome, parseCreate, parseQuery, verifyCallback } from './zalopay.ts'
import { CFG, ORDER_ID, orderRow, REF, ZALO_DATA, ZALO_MAC } from './payment-test-fixtures.ts'

const zp = CFG.zalopay!
const REDIRECT = `https://app.example.com/payment/return?order=${ORDER_ID}`

Deno.test('create: MAC khớp vector openssl, các field form đúng', async () => {
  // printf %s '2554001|261031_abcdef012345|<user>|50000|1761900000000|{"redirecturl":"<redirect>"}|[]' | openssl dgst -sha256 -hmac K1KEY
  const { url, form } = await buildCreate(
    { order: orderRow({ provider: 'zalopay', user_id: ORDER_ID }), redirectUrl: REDIRECT, callbackUrl: 'https://x.supabase.co/functions/v1/payment-ipn-zalopay', nowMs: 1761900000000 }, zp)
  assertEquals(url, 'https://sb-openapi.zalopay.vn/v2/create')
  assertEquals(form.mac, '7957e5943bc6edb8a78eee52e2aaa5d704d9a277c068b01a043e9e4c7131f576')
  assertEquals(form.app_trans_id, REF)
  assertEquals(form.item, '[]')
  assertEquals(JSON.parse(form.embed_data), { redirecturl: REDIRECT })
  assertEquals(form.expire_duration_seconds, '900')
  assertEquals(form.callback_url, 'https://x.supabase.co/functions/v1/payment-ipn-zalopay')
})

Deno.test('parseCreate: return_code 1 + order_url https', () => {
  assertEquals(parseCreate({ return_code: 1, order_url: 'https://sbgateway.zalopay.vn/openinapp?order=x' }), 'https://sbgateway.zalopay.vn/openinapp?order=x')
  assertEquals(parseCreate({ return_code: 2, order_url: 'https://x' }), null)
  assertEquals(parseCreate({ return_code: 1, order_url: 'http://x' }), null)
  assertEquals(parseCreate(null), null)
})

Deno.test('callback: MAC đúng (vector openssl, key2) được chấp nhận', async () => {
  assert(await verifyCallback({ data: ZALO_DATA, mac: ZALO_MAC }, zp))
})

Deno.test('callback: data bị sửa / MAC sai / key1 thay key2 -> từ chối', async () => {
  assert(!await verifyCallback({ data: ZALO_DATA.replace('50000', '1'), mac: ZALO_MAC }, zp))
  assert(!await verifyCallback({ data: ZALO_DATA, mac: ZALO_MAC.slice(0, 63) + '0' }, zp))
  assert(!await verifyCallback({ data: ZALO_DATA, mac: ZALO_MAC }, { ...zp, key2: zp.key1 }))
})

Deno.test('callback: MAC tính trên chuỗi data THÔ (có khoảng trắng vẫn khớp), không serialize lại', async () => {
  // printf %s '{ "app_id": 2554001, "app_trans_id": "261031_abcdef012345", "amount": 50000, "zp_trans_id": 240000000001 }' | openssl dgst -sha256 -hmac K2KEY
  const spaced = '{ "app_id": 2554001, "app_trans_id": "261031_abcdef012345", "amount": 50000, "zp_trans_id": 240000000001 }'
  assert(await verifyCallback({ data: spaced, mac: 'a66924a142379a5017c5c0133a05908105ff4c7ab02058a4b2f2cb94f0a663a1' }, zp))
  // MAC của bản đã bỏ khoảng trắng (JSON.stringify(JSON.parse(spaced))) KHÔNG được khớp chuỗi thô.
  assert(!await verifyCallback({ data: spaced, mac: ZALO_MAC }, zp))
})

Deno.test('asCallbackBody: chỉ nhận {data: string, mac: string}', () => {
  assertEquals(asCallbackBody({ data: 'd', mac: 'm', type: 1 }), { data: 'd', mac: 'm' })
  assertEquals(asCallbackBody({ data: { a: 1 }, mac: 'm' }), null)
  assertEquals(asCallbackBody({ data: 'd' }), null)
  assertEquals(asCallbackBody(null), null)
})

Deno.test('callbackOutcome: paid; app_id lạ / thiếu field / JSON hỏng -> null', () => {
  assertEquals(callbackOutcome(ZALO_DATA, zp), { kind: 'paid', orderRef: REF, txId: '240000000001', amount: 50000 })
  assertEquals(callbackOutcome(ZALO_DATA.replace('2554001', '999'), zp), null)
  assertEquals(callbackOutcome(ZALO_DATA.replace('"zp_trans_id":240000000001,', ''), zp), null)
  assertEquals(callbackOutcome('{không phải json', zp), null)
})

Deno.test('query: MAC = HMAC(key1, app_id|app_trans_id|key1) khớp vector openssl', async () => {
  // printf %s '2554001|261031_abcdef012345|K1KEY' | openssl dgst -sha256 -hmac K1KEY
  const { url, form } = await buildQuery(REF, zp)
  assertEquals(url, 'https://sb-openapi.zalopay.vn/v2/query')
  assertEquals(form, { app_id: '2554001', app_trans_id: REF, mac: 'c4831f8b77071d36b1884504e9c92b66a97455c7cca5ae775028860e791f85b8' })
})

Deno.test('parseQuery: 1 paid, 3 pending, 2 failed (trừ -101)', () => {
  assertEquals(parseQuery({ return_code: 1, amount: 50000, zp_trans_id: 240000000001 }, REF), { kind: 'paid', orderRef: REF, txId: '240000000001', amount: 50000 })
  assertEquals(parseQuery({ return_code: 1, amount: 50000 }, REF).kind, 'pending')
  assertEquals(parseQuery({ return_code: 3 }, REF).kind, 'pending')
  assertEquals(parseQuery({ return_code: 2, sub_return_code: -54 }, REF).kind, 'failed')
  assertEquals(parseQuery({ return_code: 2, sub_return_code: -101 }, REF).kind, 'pending')
  assertEquals(parseQuery(null, REF).kind, 'pending')
})
