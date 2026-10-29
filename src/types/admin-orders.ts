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
