// Kết quả + validate dùng chung cho các nhóm hành động của function `admin` (admin-actions.ts, admin-orders.ts).

export type ActionResult = { status: number; body: unknown }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ok = (body: unknown): ActionResult => ({ status: 200, body })
export const fail = (status: number, error: string): ActionResult => ({ status, body: { error } })

/** Lý do 5..500 ký tự (khớp CHECK admin_audit_log.reason), đã trim; sai -> null. */
export function readReason(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const r = v.trim()
  return r.length >= 5 && r.length <= 500 ? r : null
}

/** Lỗi RPC -> HTTP. Không trả message gốc (lộ tên bảng/ràng buộc). */
export function rpcFailure(error: { code?: string; message: string }): ActionResult {
  if (error.code === 'P0002') return fail(404, 'user_not_found')
  if (error.code === '23514') return fail(400, 'invalid_reason')
  // admin_adjust_credit: 22003 = trừ quá số dư, 22023 = delta 0 hoặc cộng vượt trần số dư int4.
  if (error.code === '22003') return fail(400, 'insufficient_credit')
  if (error.code === '22023') return fail(400, 'invalid_delta')
  console.error('admin rpc failed', error.code, error.message)
  return fail(500, 'internal_error')
}
