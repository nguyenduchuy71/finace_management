import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { buildCreate, buildQuery, ipnOutcome, ipnRawString, parseCreate, parseQuery, verifyIpn } from './momo.ts'
import { CFG, MOMO_IPN, ORDER_ID, orderRow, REF } from './payment-test-fixtures.ts'

const momo = CFG.momo!
const REDIRECT = `https://app.example.com/payment/return?order=${ORDER_ID}`
const IPN_URL = 'https://x.supabase.co/functions/v1/payment-ipn-momo'

Deno.test('create: chuỗi ký + chữ ký khớp vector openssl', async () => {
  // printf %s "accessKey=AK123&amount=50000&extraData=&ipnUrl=https://x.supabase.co/functions/v1/payment-ipn-momo&orderId=261031_abcdef012345&orderInfo=Nap 500 credit&partnerCode=MOMOTEST&redirectUrl=https://app.example.com/payment/return?order=00000000-0000-4000-8000-000000000001&requestId=261031_abcdef012345&requestType=captureWallet" | openssl dgst -sha256 -hmac SK456
  const { url, body } = await buildCreate({ order: orderRow(), redirectUrl: REDIRECT, ipnUrl: IPN_URL }, momo)
  assertEquals(url, 'https://test-payment.momo.vn/v2/gateway/api/create')
  assertEquals(body.signature, '15b7f4c8097ac559a6ff49c76d47305e228ec9b9f29efe5b2938ba62561bd2d8')
  assertEquals(body.amount, '50000') // string, không phải number
  assertEquals(body.requestType, 'captureWallet')
  assertEquals(body.orderId, REF)
  assertEquals(body.requestId, REF)
})

Deno.test('parseCreate: chỉ nhận resultCode 0 + payUrl https', () => {
  assertEquals(parseCreate({ resultCode: 0, payUrl: 'https://test-payment.momo.vn/pay/1' }), 'https://test-payment.momo.vn/pay/1')
  assertEquals(parseCreate({ resultCode: 1006, payUrl: 'https://x' }), null)
  assertEquals(parseCreate({ resultCode: 0, payUrl: 'javascript:alert(1)' }), null)
  assertEquals(parseCreate({ resultCode: 0 }), null)
  assertEquals(parseCreate(null), null)
})

Deno.test('IPN: chuỗi ký đúng thứ tự, accessKey lấy từ config', () => {
  assertEquals(ipnRawString(MOMO_IPN, 'AK123'),
    'accessKey=AK123&amount=50000&extraData=&message=Successful.&orderId=261031_abcdef012345&orderInfo=Nap 500 credit'
    + '&orderType=momo_wallet&partnerCode=MOMOTEST&payType=qr&requestId=261031_abcdef012345&responseTime=1761900000000'
    + '&resultCode=0&transId=4000000001')
})

Deno.test('IPN: chữ ký đúng (vector openssl) được chấp nhận', async () => {
  assert(await verifyIpn(MOMO_IPN, momo))
})

Deno.test('IPN: sửa bất kỳ 1 field -> từ chối', async () => {
  for (const [k, v] of Object.entries({ amount: 1, transId: 1, orderId: 'x', resultCode: 1, message: 'ok', payType: 'card' })) {
    assert(!await verifyIpn({ ...MOMO_IPN, [k]: v }, momo), `sửa ${k} vẫn qua`)
  }
  assert(!await verifyIpn({ ...MOMO_IPN, signature: undefined }, momo))
  assert(!await verifyIpn({ ...MOMO_IPN, signature: MOMO_IPN.signature.slice(0, 63) }, momo))
})

Deno.test('IPN: partnerCode lạ / sai secret -> từ chối', async () => {
  assert(!await verifyIpn({ ...MOMO_IPN, partnerCode: 'OTHER' }, momo))
  assert(!await verifyIpn(MOMO_IPN, { ...momo, secretKey: 'SK457' }))
  assert(!await verifyIpn(MOMO_IPN, { ...momo, accessKey: 'AK124' }))
})

Deno.test('IPN outcome: 0 -> paid (số nguyên), khác 0 -> failed', () => {
  assertEquals(ipnOutcome(MOMO_IPN), { kind: 'paid', orderRef: REF, txId: '4000000001', amount: 50000 })
  assertEquals(ipnOutcome({ ...MOMO_IPN, resultCode: 1006 }).kind, 'failed')
  assertEquals(ipnOutcome({ ...MOMO_IPN, amount: 50000.5 }).kind, 'failed')
  assertEquals(ipnOutcome({ ...MOMO_IPN, transId: '' }).kind, 'failed')
})

Deno.test('query: chữ ký request khớp vector openssl', async () => {
  // printf %s "accessKey=AK123&orderId=261031_abcdef012345&partnerCode=MOMOTEST&requestId=261031_abcdef012345" | openssl dgst -sha256 -hmac SK456
  const { url, body } = await buildQuery(REF, momo)
  assertEquals(url, 'https://test-payment.momo.vn/v2/gateway/api/query')
  assertEquals(body.signature, '277c0176667d8cca195c1dbacf35d3d05136b7a1752e78b3215f57fed92694f2')
})

Deno.test('parseQuery: paid / pending / failed / đơn lạ', () => {
  const ok = { partnerCode: 'MOMOTEST', orderId: REF, resultCode: 0, transId: 4000000001, amount: 50000 }
  assertEquals(parseQuery(ok, REF, momo), { kind: 'paid', orderRef: REF, txId: '4000000001', amount: 50000 })
  assertEquals(parseQuery({ ...ok, resultCode: undefined, errorCode: 0 }, REF, momo).kind, 'paid') // dạng errorCode của sample cũ
  for (const code of [1000, 7000, 7002, 9000]) assertEquals(parseQuery({ ...ok, resultCode: code }, REF, momo).kind, 'pending')
  assertEquals(parseQuery({ ...ok, resultCode: 1005 }, REF, momo).kind, 'failed')
  assertEquals(parseQuery({ ...ok, orderId: 'khac' }, REF, momo).kind, 'pending')
  assertEquals(parseQuery({ ...ok, partnerCode: 'X' }, REF, momo).kind, 'pending')
  assertEquals(parseQuery({ ...ok, transId: undefined }, REF, momo).kind, 'pending')
  assertEquals(parseQuery(null, REF, momo).kind, 'pending')
})
