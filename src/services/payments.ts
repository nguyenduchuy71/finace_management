import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ApiError } from '@/types/api'
import { toApiError } from './api-errors'
import { toInt, toISO } from './row-values'
import {
  CreatePaymentResultSchema, CreditPackageSchema, OrderStatusSchema, PAYMENT_ORDER_LIMIT, PaymentOrderSchema,
  PaymentProviderSchema,
  type CreatePaymentResult, type CreditPackage, type OrderStatus, type PaymentOrder, type PaymentProvider,
} from '@/types/payment'

// Credit chỉ được cộng ở server (IPN / đối soát). Client chỉ ĐỌC gói + đơn của mình (RLS) và nhờ function tạo / làm mới đơn.

interface PackageRow { id: string; credits: number; price_vnd: number | string }
interface OrderRow {
  id: string; provider: string; status: string; amount_vnd: number | string; credits: number; created_at: string
}

const mapOrder = (r: OrderRow): PaymentOrder => PaymentOrderSchema.parse({
  id: r.id, provider: r.provider, status: r.status, amountVnd: toInt(r.amount_vnd), credits: r.credits, createdAt: toISO(r.created_at),
})
const ORDER_COLUMNS = 'id, provider, status, amount_vnd, credits, created_at'

export async function listPackages(): Promise<CreditPackage[]> {
  const { data, error } = await supabase.from('credit_packages').select('id, credits, price_vnd').order('sort')
  if (error) throw toApiError(error)
  return ((data ?? []) as PackageRow[]).map((r) => CreditPackageSchema.parse({ id: r.id, credits: r.credits, priceVnd: toInt(r.price_vnd) }))
}

export async function listOrders(limit = PAYMENT_ORDER_LIMIT): Promise<PaymentOrder[]> {
  const { data, error } = await supabase
    .from('payment_orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(limit)
  if (error) throw toApiError(error)
  return ((data ?? []) as OrderRow[]).map(mapOrder)
}

/** Đơn theo id; null = không thấy (không tồn tại hoặc của người khác — RLS không phân biệt). */
export async function getOrder(id: string): Promise<PaymentOrder | null> {
  const { data, error } = await supabase.from('payment_orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw toApiError(error)
  return data ? mapOrder(data as OrderRow) : null
}

const FUNCTION_ERRORS: Record<string, string> = {
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  provider_disabled: 'Ví này tạm chưa mở. Vui lòng chọn ví khác.',
  too_many_pending: 'Bạn đang có quá nhiều đơn chờ thanh toán. Hãy hoàn tất hoặc đợi 15 phút rồi thử lại.',
  package_not_found: 'Gói này không còn được bán. Vui lòng chọn gói khác.',
  suspended: 'Tài khoản đang bị khoá, không nạp được credit.',
  provider_error: 'Ví chưa tạo được đơn. Vui lòng thử lại sau ít phút.',
}

/** Lỗi HTTP của functions.invoke mang Response gốc ở `context` — đọc mã lỗi từ body JSON (cùng cách services/admin.ts). */
async function toPaymentError(error: unknown): Promise<ApiError> {
  let code = 'internal_error'
  const context = (error as { context?: unknown })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (typeof body?.error === 'string') code = body.error
    } catch {
      // body không phải JSON -> giữ mã chung
    }
  }
  console.error('[create-payment]', code)
  return { code, message: FUNCTION_ERRORS[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.' }
}

async function invokePayment<T>(options: { method: 'GET' | 'POST'; body?: Record<string, unknown> }, schema: z.ZodType<T>): Promise<T> {
  let res: { data: unknown; error: unknown }
  try {
    res = await supabase.functions.invoke('create-payment', options)
  } catch (e) {
    throw await toPaymentError(e)
  }
  if (res.error) throw await toPaymentError(res.error)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    console.error('[create-payment] invalid response', parsed.error.issues)
    throw { code: 'invalid_response', message: 'Phản hồi không đúng định dạng. Vui lòng thử lại.' } satisfies ApiError
  }
  return parsed.data
}

/** Ví đang bật (đủ secret ở server). */
export async function getProviders(): Promise<PaymentProvider[]> {
  const r = await invokePayment({ method: 'GET' }, z.object({ providers: z.array(PaymentProviderSchema) }))
  return r.providers
}

/** Tạo đơn rồi trả URL ví để chuyển trang tới. */
export function createPayment(provider: PaymentProvider, packageId: string): Promise<CreatePaymentResult> {
  return invokePayment({ method: 'POST', body: { action: 'create', provider, package_id: packageId } }, CreatePaymentResultSchema)
}

/** Nhờ server hỏi provider về đơn (khi IPN chưa tới). Server tự giới hạn tần suất. */
export async function refreshOrder(orderId: string): Promise<OrderStatus> {
  const r = await invokePayment({ method: 'POST', body: { action: 'refresh', order_id: orderId } }, z.object({ status: OrderStatusSchema }))
  return r.status
}
