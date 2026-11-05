// Kiểu dùng chung của lớp thanh toán (edge function). Không phụ thuộc runtime nào.

import type { PaymentProvider } from './payment-config.ts'

export type { PaymentProvider }

/** Dòng `payment_orders` do RPC trả về (snake_case, đúng tên cột). */
export interface OrderRow {
  id: string
  user_id: string
  provider: PaymentProvider
  provider_order_ref: string
  package_id: string
  amount_vnd: number
  credits: number
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'mismatch'
  pay_url: string | null
  expires_at: string
  last_checked_at: string | null
}

/** Kết luận từ IPN/callback/query của provider về MỘT đơn. `pending` = chưa có kết luận (đang xử lý / đơn lạ). */
export type Outcome =
  | { kind: 'paid'; orderRef: string; txId: string; amount: number }
  | { kind: 'failed'; orderRef: string; reason: string }
  | { kind: 'pending' }

export interface DbResult { data: unknown; error: { message: string; code?: string } | null }
/** Phần tối thiểu của supabase-js client mà lớp thanh toán dùng — để test thay bằng đối tượng giả. */
export interface PaymentDb {
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<DbResult>
}
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>
