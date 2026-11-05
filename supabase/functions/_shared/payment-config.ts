// Đọc cấu hình cổng thanh toán từ env. Provider "bật" khi đủ secret; thiếu hoặc không hợp lệ -> undefined
// (UI ẩn ví đó, create-payment trả 503 provider_disabled). Fail closed: cấu hình sai thì TẮT, không đoán.

export type PaymentEnv = 'sandbox' | 'production'

export interface MomoConfig {
  partnerCode: string
  accessKey: string
  secretKey: string
  baseUrl: string
}
export interface ZaloPayConfig {
  appId: string
  key1: string
  key2: string
  baseUrl: string
}
export interface PaymentConfig {
  env: PaymentEnv
  /** URL trang return của app (secret, không nhận từ client -> không có open redirect). */
  returnUrl: string
  /** Gốc functions: `${SUPABASE_URL}/functions/v1` — dùng dựng ipnUrl/callback_url. */
  functionsUrl: string
  momo?: MomoConfig
  zalopay?: ZaloPayConfig
}
export type PaymentProvider = 'momo' | 'zalopay'

// Key sandbox CÔNG KHAI (MoMo: github momo-wallet/payment; ZaloPay: tutorial cộng đồng). Production mà dùng -> tắt.
const PUBLIC_SANDBOX_MOMO_PARTNERS = ['MOMO', 'MOMOBKUN20180529']
const PUBLIC_SANDBOX_MOMO_ACCESS_KEYS = ['F8BBA842ECF85', 'klm05TvNBzhg7h7j']
const PUBLIC_SANDBOX_ZALOPAY_APP_IDS = ['2553', '554']

const ENDPOINTS = {
  sandbox: { momo: 'https://test-payment.momo.vn/v2/gateway/api', zalopay: 'https://sb-openapi.zalopay.vn/v2' },
  production: { momo: 'https://payment.momo.vn/v2/gateway/api', zalopay: 'https://openapi.zalopay.vn/v2' },
} as const

type GetEnv = (name: string) => string | undefined

function validUrl(v: string | undefined, httpsOnly: boolean): string | null {
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' && (httpsOnly || u.protocol !== 'http:')) return null
    return v
  } catch {
    return null
  }
}

function req(get: GetEnv, ...names: string[]): string[] | null {
  const vals = names.map((n) => get(n)?.trim() ?? '')
  return vals.every((v) => v !== '') ? vals : null
}

/** Trả null khi cấu hình chung (PAYMENT_ENV / PAYMENT_RETURN_URL / SUPABASE_URL) hỏng: mọi provider tắt. */
export function loadPaymentConfig(get: GetEnv, log: (msg: string) => void = console.error): PaymentConfig | null {
  const env = get('PAYMENT_ENV')
  if (env !== 'sandbox' && env !== 'production') {
    log('payment: PAYMENT_ENV phải là sandbox|production -> thanh toán TẮT')
    return null
  }
  const returnUrl = validUrl(get('PAYMENT_RETURN_URL'), env === 'production')
  const supabaseUrl = validUrl(get('SUPABASE_URL'), false)
  if (!returnUrl || !supabaseUrl) {
    log('payment: PAYMENT_RETURN_URL / SUPABASE_URL thiếu hoặc không hợp lệ (production cần https) -> thanh toán TẮT')
    return null
  }
  const cfg: PaymentConfig = { env, returnUrl, functionsUrl: `${supabaseUrl.replace(/\/+$/, '')}/functions/v1` }

  const m = req(get, 'MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY')
  if (m) {
    const [partnerCode, accessKey, secretKey] = m
    if (env === 'production' && (PUBLIC_SANDBOX_MOMO_PARTNERS.includes(partnerCode) || PUBLIC_SANDBOX_MOMO_ACCESS_KEYS.includes(accessKey))) {
      log('payment: MoMo dùng key sandbox công khai ở PRODUCTION -> ví MoMo TẮT')
    } else {
      cfg.momo = { partnerCode, accessKey, secretKey, baseUrl: ENDPOINTS[env].momo }
    }
  }
  const z = req(get, 'ZALOPAY_APP_ID', 'ZALOPAY_KEY1', 'ZALOPAY_KEY2')
  if (z) {
    const [appId, key1, key2] = z
    if (!/^\d+$/.test(appId)) {
      log('payment: ZALOPAY_APP_ID phải là số -> ví ZaloPay TẮT')
    } else if (env === 'production' && PUBLIC_SANDBOX_ZALOPAY_APP_IDS.includes(appId)) {
      log('payment: ZaloPay dùng app_id sandbox công khai ở PRODUCTION -> ví ZaloPay TẮT')
    } else {
      cfg.zalopay = { appId, key1, key2, baseUrl: ENDPOINTS[env].zalopay }
    }
  }
  return cfg
}

/** Danh sách provider đang bật (cho GET create-payment). */
export function enabledProviders(cfg: PaymentConfig | null): PaymentProvider[] {
  const out: PaymentProvider[] = []
  if (cfg?.momo) out.push('momo')
  if (cfg?.zalopay) out.push('zalopay')
  return out
}
