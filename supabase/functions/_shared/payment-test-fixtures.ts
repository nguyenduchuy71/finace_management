// Fixture dùng chung cho test thanh toán. Key ở đây là GIẢ (không phải key sandbox công khai).
// Các chữ ký trong test được tính bằng `openssl dgst -sha256 -hmac <key>` (lệnh ghi cạnh từng vector), KHÔNG tính bằng
// chính hmacSha256Hex để test không tự xác nhận chính nó.
import type { PaymentConfig } from './payment-config.ts'
import type { DbResult, OrderRow, PaymentDb } from './payment-types.ts'

export const ORDER_ID = '00000000-0000-4000-8000-000000000001'
export const USER_ID = 'aaaaaaaa-0000-4000-a000-000000000001'
export const REF = '261031_abcdef012345'

export const CFG: PaymentConfig = {
  env: 'sandbox',
  returnUrl: 'https://app.example.com/payment/return',
  functionsUrl: 'https://x.supabase.co/functions/v1',
  momo: { partnerCode: 'MOMOTEST', accessKey: 'AK123', secretKey: 'SK456', baseUrl: 'https://test-payment.momo.vn/v2/gateway/api' },
  zalopay: { appId: '2554001', key1: 'K1KEY', key2: 'K2KEY', baseUrl: 'https://sb-openapi.zalopay.vn/v2' },
}

export const orderRow = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: ORDER_ID, user_id: USER_ID, provider: 'momo', provider_order_ref: REF, package_id: 'p50k', amount_vnd: 50000, credits: 500,
  status: 'pending', pay_url: null, expires_at: '2026-10-31T10:15:00Z', last_checked_at: null, ...over,
})

export interface RpcCall { fn: string; params: Record<string, unknown> | undefined }
/** DB giả: ghi lại mọi lời gọi RPC; `handlers` trả kết quả theo tên hàm (mặc định { data: null, error: null }). */
export function fakeDb(handlers: Record<string, (p: Record<string, unknown>) => DbResult> = {}): PaymentDb & { calls: RpcCall[] } {
  const calls: RpcCall[] = []
  return {
    calls,
    rpc(fn, params) {
      calls.push({ fn, params })
      return Promise.resolve(handlers[fn]?.(params ?? {}) ?? { data: null, error: null })
    },
  }
}

export const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

// --- MoMo IPN hợp lệ (openssl: printf %s "<raw>" | openssl dgst -sha256 -hmac SK456) ---
export const MOMO_IPN = {
  partnerCode: 'MOMOTEST', orderId: REF, requestId: REF, amount: 50000, orderInfo: 'Nap 500 credit', orderType: 'momo_wallet',
  transId: 4000000001, resultCode: 0, message: 'Successful.', payType: 'qr', responseTime: 1761900000000, extraData: '',
  signature: 'c4862ec0eee063e05de5abe0cdbf34bcc1bfce2a87ac899f2ece463a2b2e1f34',
}

// --- ZaloPay callback hợp lệ (openssl với key K2KEY trên chuỗi data thô) ---
export const ZALO_DATA = '{"app_id":2554001,"app_trans_id":"261031_abcdef012345","app_time":1761900000000,"app_user":"u","amount":50000,"embed_data":"{}","item":"[]","zp_trans_id":240000000001,"server_time":1761900001000,"channel":38}'
export const ZALO_MAC = '806c459fe356f788d815dbe456498187375d6ab148b8f9e0f5878d1da81030fa'
