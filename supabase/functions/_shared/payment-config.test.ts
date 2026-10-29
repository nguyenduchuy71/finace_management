import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { enabledProviders, loadPaymentConfig } from './payment-config.ts'

const BASE = {
  PAYMENT_ENV: 'sandbox', PAYMENT_RETURN_URL: 'https://app.example.com/payment/return', SUPABASE_URL: 'https://x.supabase.co',
  MOMO_PARTNER_CODE: 'REALPARTNER', MOMO_ACCESS_KEY: 'ak', MOMO_SECRET_KEY: 'sk',
  ZALOPAY_APP_ID: '3000', ZALOPAY_KEY1: 'k1', ZALOPAY_KEY2: 'k2',
}
const load = (over: Record<string, string | undefined> = {}) => {
  const logs: string[] = []
  const env = { ...BASE, ...over } as Record<string, string | undefined>
  return { cfg: loadPaymentConfig((k) => env[k], (m) => logs.push(m)), logs }
}

Deno.test('đủ secret -> cả 2 ví bật, endpoint sandbox', () => {
  const { cfg } = load()
  assertEquals(enabledProviders(cfg), ['momo', 'zalopay'])
  assertEquals(cfg?.momo?.baseUrl, 'https://test-payment.momo.vn/v2/gateway/api')
  assertEquals(cfg?.zalopay?.baseUrl, 'https://sb-openapi.zalopay.vn/v2')
  assertEquals(cfg?.functionsUrl, 'https://x.supabase.co/functions/v1')
})

Deno.test('production -> endpoint production', () => {
  const { cfg } = load({ PAYMENT_ENV: 'production' })
  assertEquals(cfg?.momo?.baseUrl, 'https://payment.momo.vn/v2/gateway/api')
  assertEquals(cfg?.zalopay?.baseUrl, 'https://openapi.zalopay.vn/v2')
})

Deno.test('thiếu 1 secret của ví -> ví đó tắt, ví kia vẫn bật', () => {
  assertEquals(enabledProviders(load({ MOMO_SECRET_KEY: undefined }).cfg), ['zalopay'])
  assertEquals(enabledProviders(load({ ZALOPAY_KEY2: '  ' }).cfg), ['momo'])
  assertEquals(enabledProviders(load({ MOMO_ACCESS_KEY: '', ZALOPAY_APP_ID: undefined }).cfg), [])
})

Deno.test('production + key sandbox công khai -> ví tắt + log lỗi (fail closed)', () => {
  for (const over of [{ MOMO_PARTNER_CODE: 'MOMO' }, { MOMO_PARTNER_CODE: 'MOMOBKUN20180529' }, { MOMO_ACCESS_KEY: 'F8BBA842ECF85' }]) {
    const { cfg, logs } = load({ PAYMENT_ENV: 'production', ...over })
    assertEquals(enabledProviders(cfg), ['zalopay'])
    assert(logs.some((l) => l.includes('MoMo')))
  }
  for (const id of ['2553', '554']) {
    const { cfg, logs } = load({ PAYMENT_ENV: 'production', ZALOPAY_APP_ID: id })
    assertEquals(enabledProviders(cfg), ['momo'])
    assert(logs.some((l) => l.includes('ZaloPay')))
  }
})

Deno.test('cùng key sandbox công khai ở sandbox -> vẫn bật', () => {
  assertEquals(enabledProviders(load({ MOMO_PARTNER_CODE: 'MOMO', ZALOPAY_APP_ID: '2553' }).cfg), ['momo', 'zalopay'])
})

Deno.test('PAYMENT_ENV thiếu/sai, return URL thiếu/không https ở production -> tắt hết', () => {
  assertEquals(load({ PAYMENT_ENV: undefined }).cfg, null)
  assertEquals(load({ PAYMENT_ENV: 'prod' }).cfg, null)
  assertEquals(load({ PAYMENT_RETURN_URL: undefined }).cfg, null)
  assertEquals(load({ PAYMENT_RETURN_URL: 'javascript:alert(1)' }).cfg, null)
  assertEquals(load({ PAYMENT_ENV: 'production', PAYMENT_RETURN_URL: 'http://app.example.com/r' }).cfg, null)
  assertEquals(enabledProviders(null), [])
})

Deno.test('ZALOPAY_APP_ID không phải số -> ví ZaloPay tắt', () => {
  assertEquals(enabledProviders(load({ ZALOPAY_APP_ID: 'abc' }).cfg), ['momo'])
})
