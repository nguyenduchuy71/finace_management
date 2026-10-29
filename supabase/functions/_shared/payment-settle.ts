// Áp kết luận của provider vào DB (fulfill_order / fail_payment_order) + ghi payment_events + đối soát đơn pending.

import type { PaymentConfig } from './payment-config.ts'
import { queryOutcome } from './payment-gateway.ts'
import type { FetchFn, OrderRow, Outcome, PaymentDb, PaymentProvider } from './payment-types.ts'

export type SettleResult = 'paid' | 'duplicate' | 'mismatch' | 'unknown_order' | 'failed' | 'noop'
export type EventSource = 'create' | 'ipn' | 'query'

// Không bao giờ ghi key/chữ ký vào payment_events.
const SECRET_FIELDS = new Set(['signature', 'mac', 'accessKey', 'secretKey', 'key1', 'key2'])

export function scrubPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  return Object.fromEntries(Object.entries(payload as Record<string, unknown>).filter(([k]) => !SECRET_FIELDS.has(k)))
}

/** Ghi log đối soát; lỗi ghi log KHÔNG được làm hỏng việc cộng credit đã xong. */
export async function logEvent(
  db: PaymentDb, provider: PaymentProvider, orderRef: string | null, txId: string | null,
  source: EventSource, result: string, payload: unknown,
): Promise<void> {
  const { error } = await db.rpc('log_payment_event', {
    p_provider: provider, p_order_ref: orderRef, p_tx_id: txId, p_source: source, p_result: result, p_payload: scrubPayload(payload),
  })
  if (error) console.error('payment_events', error.message)
}

/** Lỗi DB -> ném (IPN trả 500/return_code 0 để provider gọi lại). Mọi kết quả khác đều đã được ghi. */
export async function settle(
  db: PaymentDb, provider: PaymentProvider, outcome: Outcome, source: EventSource, payload: unknown,
): Promise<SettleResult> {
  if (outcome.kind === 'pending') return 'noop'
  let result: SettleResult
  if (outcome.kind === 'paid') {
    const { data, error } = await db.rpc('fulfill_order', {
      p_provider: provider, p_order_ref: outcome.orderRef, p_provider_tx_id: outcome.txId, p_amount: outcome.amount,
    })
    if (error) throw new Error(`fulfill_order: ${error.message}`)
    result = data as SettleResult
  } else {
    const { error } = await db.rpc('fail_payment_order', {
      p_provider: provider, p_order_ref: outcome.orderRef, p_reason: outcome.reason,
    })
    if (error) throw new Error(`fail_payment_order: ${error.message}`)
    result = 'failed'
  }
  await logEvent(db, provider, outcome.orderRef, outcome.kind === 'paid' ? outcome.txId : null, source, result, payload)
  return result
}

/**
 * Hỏi provider về 1 đơn pending rồi áp kết quả. Chỉ đánh dấu "đã hỏi" khi provider TRẢ LỜI (kể cả "chưa xong"):
 * expire_stale_orders chỉ hết hạn đơn đã được hỏi sau hạn, nên lỗi mạng không được biến thành "đơn hết hạn".
 */
export async function reconcileOrder(
  db: PaymentDb, order: OrderRow, cfg: PaymentConfig, fetchFn: FetchFn,
): Promise<SettleResult> {
  try {
    const outcome = await queryOutcome(order, cfg, fetchFn)
    const result = await settle(db, order.provider, outcome, 'query', { order_ref: order.provider_order_ref })
    const { error } = await db.rpc('mark_order_checked', { p_order: order.id })
    if (error) console.error('mark_order_checked', error.message)
    return result
  } catch (e) {
    console.error('reconcile', order.provider, String(e))
    return 'noop'
  }
}
