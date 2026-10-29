import { z } from 'zod'

/**
 * Đơn thanh toán trong trang quản trị — CHỈ metadata (function `admin` không trả pay_url, payload IPN, chữ ký).
 * Response của action `list_orders` đã là camelCase (function tự dựng).
 */
const iso = z.string().datetime({ offset: true })

export const OrderStatusSchema = z.enum(['pending', 'paid', 'expired', 'failed', 'mismatch'])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderProviderSchema = z.enum(['momo', 'zalopay'])
export type OrderProvider = z.infer<typeof OrderProviderSchema>

export const AdminOrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string().nullable(),
  provider: OrderProviderSchema,
  providerOrderRef: z.string(),
  providerTxId: z.string().nullable(),
  amountVnd: z.number().int(),
  credits: z.number().int(),
  status: OrderStatusSchema,
  createdAt: iso,
  paidAt: iso.nullable(),
  lastCheckedAt: iso.nullable(),
})
export type AdminOrder = z.infer<typeof AdminOrderSchema>

export type AdminOrderFilters = { status: OrderStatus | null; provider: OrderProvider | null }

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Đang chờ',
  paid: 'Đã thanh toán',
  expired: 'Hết hạn',
  failed: 'Thất bại',
  mismatch: 'Lệch tiền / quá hạn',
}

export const ORDER_PROVIDER_LABEL: Record<OrderProvider, string> = { momo: 'MoMo', zalopay: 'ZaloPay' }

/** Cách xử lý tay: cộng credit của đơn (đúng 1 lần) hoặc đóng đơn là thất bại. */
export type OrderResolution = 'mark_paid' | 'mark_failed'

/** Đơn đã 'paid' không xử lý lại được; đơn 'failed' không cần "đánh dấu thất bại" nữa (khớp RPC admin_resolve_order). */
export function allowedResolutions(status: OrderStatus): OrderResolution[] {
  if (status === 'paid') return []
  return status === 'failed' ? ['mark_paid'] : ['mark_paid', 'mark_failed']
}

/** Mã giao dịch của ví (MoMo transId / ZaloPay zp_trans_id): khớp kiểm ở function + RPC (trim, 1..100 ký tự). */
export const OrderTxIdSchema = z.string().trim().min(1).max(100)

/** Kết quả đối soát gần nhất (cron 5 phút/lần) + số đơn pending kẹt. `null` ở response = server không đọc được. */
export const ReconcileStatusSchema = z.object({
  lastOutcome: z.string().nullable(),
  lastAt: iso.nullable(),
  lastHttpStatus: z.number().int().nullable(),
  stalePending: z.number().int(),
})
export type ReconcileStatus = z.infer<typeof ReconcileStatusSchema>

export const AdminOrdersResultSchema = z.object({
  orders: z.array(AdminOrderSchema),
  reconcile: ReconcileStatusSchema.nullable(),
})
export type AdminOrdersResult = z.infer<typeof AdminOrdersResultSchema>

/** Cron mỗi 5 phút: quá ngần này không có dòng mới = cron chết / bị tắt. Cũng là ngưỡng "đơn pending kẹt" ở DB. */
export const RECONCILE_STALE_MINUTES = 15

/** Các cảnh báo đối soát cần admin xem (rỗng = bình thường). `nowMs` tiêm vào để test. */
export function reconcileWarnings(r: ReconcileStatus | null, nowMs: number): string[] {
  if (!r) return ['Không đọc được trạng thái đối soát tự động. Kiểm tra lịch cron và log function.']
  const out: string[] = []
  if (!r.lastOutcome || !r.lastAt) {
    out.push('Chưa ghi nhận lần đối soát tự động nào. Kiểm tra lịch cron (pg_cron) trên production.')
  } else {
    const ageMin = Math.floor((nowMs - new Date(r.lastAt).getTime()) / 60_000)
    if (r.lastOutcome.startsWith('skipped:')) {
      out.push(`Lần đối soát gần nhất bị bỏ qua (${r.lastOutcome.slice('skipped:'.length)}): thiếu extension hoặc secret trong Vault.`)
    }
    if (ageMin > RECONCILE_STALE_MINUTES) {
      out.push(`Đối soát tự động lần cuối cách đây ${ageMin} phút (lịch là 5 phút/lần): cron có thể đã dừng.`)
    }
    if (r.lastHttpStatus !== null && (r.lastHttpStatus < 200 || r.lastHttpStatus >= 300)) {
      out.push(`Function payment-reconcile trả mã ${r.lastHttpStatus} ở lần gọi gần nhất.`)
    }
  }
  if (r.stalePending > 0) {
    out.push(`${r.stalePending} đơn đang chờ quá ${RECONCILE_STALE_MINUTES} phút mà chưa được hỏi cổng thanh toán.`)
  }
  return out
}
