// Hành động đơn thanh toán của function `admin`: list_orders (chỉ metadata) + resolve_order (mark_paid / mark_failed).
// Không bao giờ trả pay_url, payload IPN hay chữ ký: RPC admin_list_orders không chọn các cột đó.

import { isAdminUser } from './admin-auth.ts'
import { fail, ok, readReason, rpcFailure, UUID, type ActionResult } from './admin-result.ts'
import type { AdminDeps } from './admin-actions.ts'

const STATUSES = ['pending', 'paid', 'expired', 'failed', 'mismatch']
const PROVIDERS = ['momo', 'zalopay']
const OPTIONS = ['mark_paid', 'mark_failed']
const LIST_LIMIT = 100
const MAX_TX_ID_LENGTH = 100

type ReconcileRow = { last_outcome: string | null; last_at: string | null; last_http_status: number | null; stale_pending: number | string }

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

  const [orders, recon] = await Promise.all([
    deps.rpc('admin_list_orders', { p_status: status, p_provider: provider, p_user: userId, p_limit: LIST_LIMIT }),
    deps.rpc('admin_reconcile_status', {}),
  ])
  if (orders.error) return rpcFailure(orders.error)
  // Chỉ tra email của user có trong trang (≤ LIST_LIMIT lần getUserById) thay vì liệt kê mọi user.
  const ids = [...new Set((orders.data as OrderRow[]).map((o) => o.user_id))]
  const emailOf = new Map(await Promise.all(ids.map(async (id) => [id, (await deps.getAuthUser(id))?.email ?? null] as const)))
  // Trạng thái đối soát chỉ để cảnh báo: không đọc được thì trả null (UI báo "không rõ"), không chặn xử lý đơn.
  const r = recon.error ? null : (recon.data as ReconcileRow[])[0] ?? null
  if (recon.error) console.error('admin_reconcile_status failed', recon.error.code, recon.error.message)
  return ok({
    reconcile: r && {
      lastOutcome: r.last_outcome, lastAt: r.last_at, lastHttpStatus: r.last_http_status, stalePending: Number(r.stale_pending),
    },
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
  // Mã giao dịch của ví: tuỳ chọn ở đây (đơn đã có mã thì không cần); RPC bắt buộc khi đơn chưa có mã.
  let txId: string | null = null
  if (body.providerTxId !== undefined && body.providerTxId !== null) {
    if (typeof body.providerTxId !== 'string') return fail(400, 'invalid_tx_id')
    txId = body.providerTxId.trim() || null
    if (txId && txId.length > MAX_TX_ID_LENGTH) return fail(400, 'invalid_tx_id')
  }

  // Như loadTarget: không xử lý đơn của chính mình / của admin khác (cộng credit cho admin = leo thang).
  const owner = await deps.rpc('admin_order_owner', { p_order: body.orderId })
  if (owner.error) return rpcFailure(owner.error)
  if (typeof owner.data !== 'string') return fail(404, 'order_not_found')
  if (owner.data === adminId) return fail(400, 'cannot_target_self')
  const user = await deps.getAuthUser(owner.data)
  if (user && isAdminUser(user)) return fail(400, 'cannot_target_admin')

  const res = await deps.rpc('admin_resolve_order', {
    p_admin: adminId, p_order: body.orderId, p_option: body.option, p_reason: reason, p_provider_tx_id: txId,
  })
  if (res.error) {
    // Ánh xạ riêng của hành động này (rpcFailure chung dành cho user/credit nên gán sai nghĩa 22023/42501).
    const { code, message } = res.error
    if (code === 'P0002') return fail(404, 'order_not_found')
    if (code === '55000') return fail(409, 'order_not_resolvable')
    if (code === '23505') return fail(409, 'tx_id_in_use')
    if (code === '22023') return fail(400, 'invalid_input')
    // 42501 cũng là "permission denied": chỉ ca RPC tự ném (tin nhắn của ta) mới là đơn của chính mình.
    if (code === '42501' && message.includes('chính mình')) return fail(400, 'cannot_target_self')
    if (code === '23514') return fail(400, 'invalid_reason')
    console.error('admin resolve_order failed', code, message)
    return fail(500, 'internal_error')
  }
  return ok(res.data)
}
