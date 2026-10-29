import { z } from 'zod'

/** Khớp CHECK `payment_orders.provider` / `.status`. */
export const PaymentProviderSchema = z.enum(['momo', 'zalopay'])
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>

export const OrderStatusSchema = z.enum(['pending', 'paid', 'expired', 'failed', 'mismatch'])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

/** Gói bán (bảng `credit_packages`, sửa bằng SQL — UI không hardcode giá/credit). */
export const CreditPackageSchema = z.object({
  id: z.string(),
  credits: z.number().int().positive(),
  priceVnd: z.number().int().positive(),
})
export type CreditPackage = z.infer<typeof CreditPackageSchema>

export const PaymentOrderSchema = z.object({
  id: z.string().uuid(),
  provider: PaymentProviderSchema,
  status: OrderStatusSchema,
  amountVnd: z.number().int().positive(),
  credits: z.number().int().positive(),
  createdAt: z.string().datetime(),
})
export type PaymentOrder = z.infer<typeof PaymentOrderSchema>

/** Response function `create-payment` action create. Chỉ nhận https: không bao giờ điều hướng tới javascript:/http:. */
export const CreatePaymentResultSchema = z.object({
  order_id: z.string().uuid(),
  pay_url: z.string().url().refine((u) => u.startsWith('https://'), 'pay_url phải là https'),
}).transform((r) => ({ orderId: r.order_id, payUrl: r.pay_url }))
export type CreatePaymentResult = z.infer<typeof CreatePaymentResultSchema>

export const PROVIDER_LABEL: Record<PaymentProvider, string> = { momo: 'MoMo', zalopay: 'ZaloPay' }

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã nhận',
  expired: 'Hết hạn',
  failed: 'Thất bại',
  mismatch: 'Cần hỗ trợ',
}

/** Trạng thái cuối: ngừng poll. */
export const isFinalStatus = (s: OrderStatus): boolean => s !== 'pending'

/** Số đơn hiện ở lịch sử trang Cài đặt. */
export const PAYMENT_ORDER_LIMIT = 20
/** Ngừng poll đơn pending sau ngần này (đơn hết hạn 15 phút + đối soát). */
export const PAYMENT_POLL_MAX_MS = 20 * 60 * 1000
