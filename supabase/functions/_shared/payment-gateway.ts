// Gọi HTTP tới MoMo / ZaloPay (create + query). fetch được tiêm vào để test không chạm mạng.

import type { PaymentConfig } from './payment-config.ts'
import * as momo from './momo.ts'
import * as zalopay from './zalopay.ts'
import type { FetchFn, OrderRow, Outcome } from './payment-types.ts'

const TIMEOUT_MS = 15_000

async function postJson(fetchFn: FetchFn, url: string, init: RequestInit): Promise<unknown> {
  const res = await fetchFn(url, { ...init, method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) })
  // Provider trả JSON kể cả khi lỗi nghiệp vụ; HTML (WAF/5xx) -> ném để caller coi là lỗi tạm.
  return await res.json()
}
const jsonInit = (body: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const formInit = (form: Record<string, string>): RequestInit => ({
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(),
})

/** URL ví để chuyển user tới; null = provider từ chối / provider không bật. Ném khi lỗi mạng/định dạng. */
export async function createPayUrl(
  order: OrderRow, cfg: PaymentConfig, fetchFn: FetchFn, nowMs: number,
): Promise<string | null> {
  // returnUrl là secret của ta + id đơn của ta (UUID): không có input client nào lọt vào URL.
  const redirectUrl = `${cfg.returnUrl}${cfg.returnUrl.includes('?') ? '&' : '?'}order=${order.id}`
  if (order.provider === 'momo' && cfg.momo) {
    const { url, body } = await momo.buildCreate(
      { order, redirectUrl, ipnUrl: `${cfg.functionsUrl}/payment-ipn-momo` }, cfg.momo)
    return momo.parseCreate(await postJson(fetchFn, url, jsonInit(body)))
  }
  if (order.provider === 'zalopay' && cfg.zalopay) {
    const { url, form } = await zalopay.buildCreate(
      { order, redirectUrl, callbackUrl: `${cfg.functionsUrl}/payment-ipn-zalopay`, nowMs }, cfg.zalopay)
    return zalopay.parseCreate(await postJson(fetchFn, url, formInit(form)))
  }
  return null
}

/** Hỏi provider trạng thái đơn. Ném khi lỗi mạng/định dạng; provider không bật -> pending. */
export async function queryOutcome(order: OrderRow, cfg: PaymentConfig, fetchFn: FetchFn): Promise<Outcome> {
  const ref = order.provider_order_ref
  if (order.provider === 'momo' && cfg.momo) {
    const { url, body } = await momo.buildQuery(ref, cfg.momo)
    return momo.parseQuery(await postJson(fetchFn, url, jsonInit(body)), ref, cfg.momo)
  }
  if (order.provider === 'zalopay' && cfg.zalopay) {
    const { url, form } = await zalopay.buildQuery(ref, cfg.zalopay)
    return zalopay.parseQuery(await postJson(fetchFn, url, formInit(form)), ref)
  }
  return { kind: 'pending' }
}
