// MoMo captureWallet (AIO v2): dựng request, kiểm chữ ký IPN, đọc kết quả query. Hàm thuần (trừ HMAC async).
//
// Nguồn: github.com/momo-wallet/payment (nodejs/MoMo.js, php/PayMoMo/*). developers.momo.vn trả 403 cho bot nên
// các điểm sau CHƯA kiểm với spec chữ: URL production (payment.momo.vn), IPN content-type (xử lý JSON), mã trả IPN
// (204), độ dài orderId (ref của ta 19 ký tự), field hạn đơn (không gửi; hạn 15 phút do DB + đối soát lo).
// Chuỗi ký (key = secretKey, HMAC-SHA256 hex thường, key=value nối '&', KHÔNG URL-encode), thứ tự chữ cái cố định.

import { hmacSha256Hex, signatureValid } from './payment-hmac.ts'
import type { MomoConfig } from './payment-config.ts'
import type { OrderRow, Outcome } from './payment-types.ts'

const REQUEST_TYPE = 'captureWallet'

export interface MomoCreateInput { order: OrderRow; redirectUrl: string; ipnUrl: string }

export async function buildCreate(input: MomoCreateInput, cfg: MomoConfig): Promise<{ url: string; body: Record<string, unknown> }> {
  const { order } = input
  const amount = String(order.amount_vnd)
  const orderInfo = `Nap ${order.credits} credit`   // ASCII: tránh lệch mã hoá khi ký
  const raw = `accessKey=${cfg.accessKey}&amount=${amount}&extraData=&ipnUrl=${input.ipnUrl}&orderId=${order.provider_order_ref}`
    + `&orderInfo=${orderInfo}&partnerCode=${cfg.partnerCode}&redirectUrl=${input.redirectUrl}`
    + `&requestId=${order.provider_order_ref}&requestType=${REQUEST_TYPE}`
  return {
    url: `${cfg.baseUrl}/create`,
    body: {
      partnerCode: cfg.partnerCode, accessKey: cfg.accessKey, requestId: order.provider_order_ref, amount,
      orderId: order.provider_order_ref, orderInfo, redirectUrl: input.redirectUrl, ipnUrl: input.ipnUrl,
      extraData: '', requestType: REQUEST_TYPE, lang: 'vi', signature: await hmacSha256Hex(cfg.secretKey, raw),
    },
  }
}

/** Đọc payUrl từ response create; null nếu MoMo từ chối. */
export function parseCreate(res: unknown): string | null {
  const r = res as Record<string, unknown> | null
  return r && Number(r.resultCode) === 0 && typeof r.payUrl === 'string' && r.payUrl.startsWith('https://') ? r.payUrl : null
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

/** Chuỗi ký của IPN. accessKey lấy từ config (IPN không mang accessKey). */
export function ipnRawString(b: Record<string, unknown>, accessKey: string): string {
  return `accessKey=${accessKey}&amount=${str(b.amount)}&extraData=${str(b.extraData)}&message=${str(b.message)}`
    + `&orderId=${str(b.orderId)}&orderInfo=${str(b.orderInfo)}&orderType=${str(b.orderType)}&partnerCode=${str(b.partnerCode)}`
    + `&payType=${str(b.payType)}&requestId=${str(b.requestId)}&responseTime=${str(b.responseTime)}`
    + `&resultCode=${str(b.resultCode)}&transId=${str(b.transId)}`
}

/** partnerCode khớp config + chữ ký đúng. Sai bất kỳ -> false (caller trả 400, KHÔNG chạm DB). */
export async function verifyIpn(b: Record<string, unknown>, cfg: MomoConfig): Promise<boolean> {
  if (str(b.partnerCode) !== cfg.partnerCode) return false
  return await signatureValid(cfg.secretKey, ipnRawString(b, cfg.accessKey), b.signature)
}

/** IPN đã xác thực -> kết luận. resultCode 0 = trả tiền thành công; khác = thất bại. */
export function ipnOutcome(b: Record<string, unknown>): Outcome {
  const orderRef = str(b.orderId)
  if (Number(b.resultCode) !== 0) return { kind: 'failed', orderRef, reason: `resultCode ${str(b.resultCode)}` }
  const amount = Number(b.amount)
  const txId = str(b.transId)
  if (!txId || !Number.isInteger(amount)) return { kind: 'failed', orderRef, reason: 'thiếu transId/amount' }
  return { kind: 'paid', orderRef, txId, amount }
}

export async function buildQuery(orderRef: string, cfg: MomoConfig): Promise<{ url: string; body: Record<string, unknown> }> {
  const raw = `accessKey=${cfg.accessKey}&orderId=${orderRef}&partnerCode=${cfg.partnerCode}&requestId=${orderRef}`
  return {
    url: `${cfg.baseUrl}/query`,
    body: {
      partnerCode: cfg.partnerCode, requestId: orderRef, orderId: orderRef, requestType: REQUEST_TYPE, lang: 'vi',
      signature: await hmacSha256Hex(cfg.secretKey, raw),
    },
  }
}

// Mã "chưa xong": khởi tạo / đang xử lý / đã uỷ quyền. Mã khác 0 còn lại = thất bại (huỷ, hết hạn, từ chối...).
const PENDING_CODES = new Set([1000, 7000, 7002, 9000])

/**
 * Kết quả query (reconcile). Response query v2 không có chuỗi ký mà ta kiểm chứng được -> tin kênh TLS tới host MoMo,
 * nhưng bắt buộc partnerCode + orderId khớp đơn đã hỏi; số tiền vẫn được fulfill_order so với DB.
 * Query trả `resultCode` (v2) hoặc `errorCode` (sample cũ): 0 = thành công.
 */
export function parseQuery(res: unknown, orderRef: string, cfg: MomoConfig): Outcome {
  const r = res as Record<string, unknown> | null
  if (!r || str(r.orderId) !== orderRef || str(r.partnerCode) !== cfg.partnerCode) return { kind: 'pending' }
  const code = Number(r.resultCode ?? r.errorCode)
  if (Number.isNaN(code) || PENDING_CODES.has(code)) return { kind: 'pending' }
  if (code !== 0) return { kind: 'failed', orderRef, reason: `query resultCode ${code}` }
  const amount = Number(r.amount)
  const txId = str(r.transId)
  if (!txId || !Number.isInteger(amount)) return { kind: 'pending' }
  return { kind: 'paid', orderRef, txId, amount }
}
