// Hành động đơn thanh toán của function `admin`: list_orders (chỉ metadata) + resolve_order (mark_paid / mark_failed).
// Không bao giờ trả pay_url, payload IPN hay chữ ký: RPC admin_list_orders không chọn các cột đó.

import { fail, ok, readReason, rpcFailure, UUID, type ActionResult } from './admin-result.ts'
import type { AdminDeps } from './admin-actions.ts'

const STATUSES = ['pending', 'paid', 'expired', 'failed', 'mismatch']
const PROVIDERS = ['momo', 'zalopay']
const OPTIONS = ['mark_paid', 'mark_failed']
const LIST_LIMIT = 100

type OrderRow = {
  id: string; user_id: string; provider: string; provider_order_ref: string; provider_tx_id: string | null
  amount_vnd: number; credits: number; status: string
  created_at: string; paid_at: string | null; last_checked_at: string | null
}

/** Giá trị lọc tuỳ chọn: thiếu/null -> null; có mà sai -> undefined (400). */
function readFilter(v: unknown, allowed: string[]): string | null | undefined {
  if (v === undefined || v === null || v === '') return null
  return typeof v === 'string' && allowed.includes(v) ? v : undefined
}

export async function handleListOrders(deps: AdminDeps, body: Record<string, unknown>): Promise<ActionResult> {
  const status = readFilter(body.status, STATUSES)
  if (status === undefined) return fail(400, 'invalid_status')
  const provider = readFilter(body.provider, PROVIDERS)
  if (provider === undefined) return fail(400, 'invalid_provider')
  const userId = body.userId ?? null
  if (userId !== null && (typeof userId !== 'string' || !UUID.test(userId))) return fail(400, 'invalid_user_id')

  const [users, orders] = await Promise.all([
    deps.listAuthUsers(),
    deps.rpc('admin_list_orders', { p_status: status, p_provider: provider, p_user: userId, p_limit: LIST_LIMIT }),
  ])
  if (orders.error) return rpcFailure(orders.error)
  const emailOf = new Map(users.map((u) => [u.id, u.email ?? null]))
  return ok({
    orders: (orders.data as OrderRow[]).map((o) => ({
      id: o.id,
      userId: o.user_id,
      email: emailOf.get(o.user_id) ?? null,
      provider: o.provider,
      providerOrderRef: o.provider_order_ref,
      providerTxId: o.provider_tx_id,
      amountVnd: o.amount_vnd,
      credits: o.credits,
      status: o.status,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      lastCheckedAt: o.last_checked_at,
    })),
  })
}

export async function handleResolveOrder(
  deps: AdminDeps, adminId: string, body: Record<string, unknown>,
): Promise<ActionResult> {
  if (typeof body.orderId !== 'string' || !UUID.test(body.orderId)) return fail(400, 'invalid_order_id')
  if (typeof body.option !== 'string' || !OPTIONS.includes(body.option)) return fail(400, 'invalid_option')
  const reason = readReason(body.reason)
  if (!reason) return fail(400, 'invalid_reason')

  const res = await deps.rpc('admin_resolve_order', {
    p_admin: adminId, p_order: body.orderId, p_option: body.option, p_reason: reason,
  })
  if (res.error) {
    // Mã riêng của đơn; còn lại rơi về ánh xạ chung.
    if (res.error.code === 'P0002') return fail(404, 'order_not_found')
    if (res.error.code === '55000') return fail(409, 'order_not_resolvable')
    if (res.error.code === '42501') return fail(400, 'cannot_target_self')
    return rpcFailure(res.error)
  }
  return ok(res.data)
}
