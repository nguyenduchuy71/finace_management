// ZaloPay Gateway (order API v2): dựng create/query, kiểm MAC callback, đọc kết quả. Hàm thuần (trừ HMAC async).
//
// Nguồn: docs.zalopay.vn (order-create, order-query, callback, secure-data-transmission). Chưa chạy thật lần nào
// (không có key sandbox công khai). Điểm CHƯA kiểm: host sandbox/production, mã trả callback (1 / -1 / 0 như sample),
// MAC của query (key1), content-type create/query (form-urlencoded theo docs).
// MAC create/query: HMAC(key1, a|b|c...); MAC callback: HMAC(key2, chuỗi `data` THÔ nhận được).

import { hmacSha256Hex, signatureValid } from './payment-hmac.ts'
import type { ZaloPayConfig } from './payment-config.ts'
import type { OrderRow, Outcome } from './payment-types.ts'

export interface ZaloCreateInput { order: OrderRow; redirectUrl: string; callbackUrl: string; nowMs: number }

/** Body form-urlencoded của /create. embed_data.redirecturl chỉ để UI quay về (không bao giờ cộng credit). */
export async function buildCreate(input: ZaloCreateInput, cfg: ZaloPayConfig): Promise<{ url: string; form: Record<string, string> }> {
  const { order } = input
  const embedData = JSON.stringify({ redirecturl: input.redirectUrl })
  const item = '[]'
  const appUser = order.user_id
  const amount = String(order.amount_vnd)
  const appTime = String(input.nowMs)
  const mac = await hmacSha256Hex(
    cfg.key1, `${cfg.appId}|${order.provider_order_ref}|${appUser}|${amount}|${appTime}|${embedData}|${item}`)
  return {
    url: `${cfg.baseUrl}/create`,
    form: {
      app_id: cfg.appId, app_user: appUser, app_time: appTime, amount, app_trans_id: order.provider_order_ref,
      embed_data: embedData, item, description: `Nap ${order.credits} credit`, bank_code: '',
      callback_url: input.callbackUrl, expire_duration_seconds: '900', mac,
    },
  }
}

export function parseCreate(res: unknown): string | null {
  const r = res as Record<string, unknown> | null
  return r && Number(r.return_code) === 1 && typeof r.order_url === 'string' && r.order_url.startsWith('https://') ? r.order_url : null
}

export interface ZaloCallbackBody { data: string; mac: string }

/** Body callback hợp lệ về hình dạng (data/mac là chuỗi). MAC tính trên `data` NGUYÊN VĂN, không parse rồi serialize lại. */
export function asCallbackBody(v: unknown): ZaloCallbackBody | null {
  const b = v as Record<string, unknown> | null
  return b && typeof b.data === 'string' && typeof b.mac === 'string' ? { data: b.data, mac: b.mac } : null
}

export async function verifyCallback(b: ZaloCallbackBody, cfg: ZaloPayConfig): Promise<boolean> {
  return await signatureValid(cfg.key2, b.data, b.mac)
}

/** `data` (đã qua MAC) -> kết luận. app_id phải là app của ta. Callback chỉ gửi khi đã thanh toán. */
export function callbackOutcome(dataJson: string, cfg: ZaloPayConfig): Outcome | null {
  let d: Record<string, unknown>
  try { d = JSON.parse(dataJson) } catch { return null }
  if (!d || String(d.app_id) !== cfg.appId) return null
  const amount = Number(d.amount)
  const txId = d.zp_trans_id === undefined ? '' : String(d.zp_trans_id)
  if (typeof d.app_trans_id !== 'string' || !txId || !Number.isInteger(amount)) return null
  return { kind: 'paid', orderRef: d.app_trans_id, txId, amount }
}

export async function buildQuery(orderRef: string, cfg: ZaloPayConfig): Promise<{ url: string; form: Record<string, string> }> {
  return {
    url: `${cfg.baseUrl}/query`,
    form: { app_id: cfg.appId, app_trans_id: orderRef, mac: await hmacSha256Hex(cfg.key1, `${cfg.appId}|${orderRef}|${cfg.key1}`) },
  }
}

/** Response query không có MAC -> tin kênh TLS tới openapi.zalopay.vn. 1 = đã trả, 3 = đang xử lý, 2 = thất bại. */
export function parseQuery(res: unknown, orderRef: string): Outcome {
  const r = res as Record<string, unknown> | null
  if (!r) return { kind: 'pending' }
  const code = Number(r.return_code)
  if (code === 1) {
    const amount = Number(r.amount)
    const txId = r.zp_trans_id === undefined ? '' : String(r.zp_trans_id)
    return txId && Number.isInteger(amount) ? { kind: 'paid', orderRef, txId, amount } : { kind: 'pending' }
  }
  // 2 = thất bại, nhưng sub_return_code -101 = ZaloPay chưa biết đơn (create chưa tới nơi): không kết luận.
  if (code === 2 && Number(r.sub_return_code) !== -101) return { kind: 'failed', orderRef, reason: `query sub ${String(r.sub_return_code)}` }
  return { kind: 'pending' }
}
