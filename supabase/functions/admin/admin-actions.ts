// Router hành động của function `admin` — danh sách cho phép ĐÓNG, mọi tham số validate ở đây.
// Chỉ trả METADATA: email + mốc thời gian từ GoTrue, số đếm từ RPC admin_user_stats. Không có
// số tiền, mô tả, raw_text, tên người chuyển (RPC không chọn các cột đó).

import { isAdminUser, type GoTrueUser } from './admin-auth.ts'

/** Các trường của GoTrue User mà admin được thấy. */
export type AuthUser = GoTrueUser & {
  email?: string
  created_at: string
  last_sign_in_at?: string | null
  banned_until?: string | null
}

export type RpcResult = { data: unknown; error: { code?: string; message: string } | null }

/** Phụ thuộc bên ngoài — tiêm vào để test không cần GoTrue/DB. */
export interface AdminDeps {
  listAuthUsers(): Promise<AuthUser[]>
  getAuthUser(id: string): Promise<AuthUser | null>
  /** Ban/gỡ ban ở GoTrue (chặn đăng nhập + refresh token). Throw khi lỗi. */
  setBan(id: string, banned: boolean): Promise<void>
  rpc(fn: string, params: Record<string, unknown>): PromiseLike<RpcResult>
}

export type ActionResult = { status: number; body: unknown }

type StatsRow = {
  user_id: string
  suspended_at: string | null
  suspended_reason: string | null
  consent_at: string | null
  keys_active: number
  keys_last_used_at: string | null
  tx_count_30d: number
  unparsed_30d: Record<string, number>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ok = (body: unknown): ActionResult => ({ status: 200, body })
const fail = (status: number, error: string): ActionResult => ({ status, body: { error } })

/**
 * Tỉ lệ tin ghi thành giao dịch trên tin "trông như giao dịch" (bỏ OTP/promo vốn không lưu,
 * no_account là lỗi cấu hình TK của user chứ không phải parser). null khi chưa có tin nào.
 */
export function parseRate(tx: number, unparsed: Record<string, number>): number | null {
  const failed = (unparsed.no_match ?? 0) + (unparsed.invalid_parse ?? 0)
  return tx + failed === 0 ? null : Math.round((tx / (tx + failed)) * 1000) / 1000
}

function toUserView(u: AuthUser, s: StatsRow | undefined) {
  const unparsed = s?.unparsed_30d ?? {}
  return {
    id: u.id,
    email: u.email ?? null,
    isAdmin: isAdminUser(u),
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    bannedUntil: u.banned_until ?? null,
    suspendedAt: s?.suspended_at ?? null,
    suspendedReason: s?.suspended_reason ?? null,
    consentAt: s?.consent_at ?? null,
    keysActive: s?.keys_active ?? 0,
    keysLastUsedAt: s?.keys_last_used_at ?? null,
    txCount30d: s?.tx_count_30d ?? 0,
    unparsed30d: unparsed,
    parseRate30d: parseRate(s?.tx_count_30d ?? 0, unparsed),
  }
}

/** Lỗi RPC -> HTTP. Không trả message gốc (lộ tên bảng/ràng buộc). */
function rpcFailure(error: { code?: string; message: string }): ActionResult {
  if (error.code === 'P0002') return fail(404, 'user_not_found')
  if (error.code === '23514') return fail(400, 'invalid_reason')
  console.error('admin rpc failed', error.code, error.message)
  return fail(500, 'internal_error')
}

function readReason(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const r = v.trim()
  return r.length >= 5 && r.length <= 500 ? r : null
}

/**
 * Hành động thay đổi user: target phải tồn tại, không phải chính mình, không phải admin khác
 * (admin tự khoá mình = mất quyền quản trị; khoá admin khác = leo thang giữa các admin).
 */
async function loadTarget(deps: AdminDeps, adminId: string, userId: unknown):
  Promise<{ user: AuthUser } | { error: ActionResult }> {
  if (typeof userId !== 'string' || !UUID.test(userId)) return { error: fail(400, 'invalid_user_id') }
  if (userId === adminId) return { error: fail(400, 'cannot_target_self') }
  const user = await deps.getAuthUser(userId)
  if (!user) return { error: fail(404, 'user_not_found') }
  if (isAdminUser(user)) return { error: fail(400, 'cannot_target_admin') }
  return { user }
}

export async function handleAction(
  deps: AdminDeps, adminId: string, body: Record<string, unknown>,
): Promise<ActionResult> {
  switch (body.action) {
    case 'list_users': {
      const search = typeof body.search === 'string' ? body.search.trim().toLowerCase() : ''
      const [users, stats] = await Promise.all([
        deps.listAuthUsers(),
        deps.rpc('admin_user_stats', { p_user_ids: null }),
      ])
      if (stats.error) return rpcFailure(stats.error)
      const byId = new Map((stats.data as StatsRow[]).map((s) => [s.user_id, s]))
      const view = users
        .filter((u) => !search || (u.email ?? '').toLowerCase().includes(search))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((u) => toUserView(u, byId.get(u.id)))
      return ok({ users: view })
    }

    case 'get_user': {
      if (typeof body.userId !== 'string' || !UUID.test(body.userId)) return fail(400, 'invalid_user_id')
      const user = await deps.getAuthUser(body.userId)
      if (!user) return fail(404, 'user_not_found')
      // Ghi dấu vết TRƯỚC khi trả dữ liệu: ghi lỗi thì không trả (fail closed).
      const logged = await deps.rpc('admin_log_view', { p_admin: adminId, p_user: user.id })
      if (logged.error) return rpcFailure(logged.error)
      const [stats, keys] = await Promise.all([
        deps.rpc('admin_user_stats', { p_user_ids: [user.id] }),
        deps.rpc('admin_user_keys', { p_user: user.id }),
      ])
      if (stats.error) return rpcFailure(stats.error)
      if (keys.error) return rpcFailure(keys.error)
      return ok({ user: toUserView(user, (stats.data as StatsRow[])[0]), keys: keys.data })
    }

    case 'suspend':
    case 'unsuspend': {
      const reason = readReason(body.reason)
      if (!reason) return fail(400, 'invalid_reason')
      const target = await loadTarget(deps, adminId, body.userId)
      if ('error' in target) return target.error
      const suspend = body.action === 'suspend'
      // DB trước: cờ khoá chặn Shortcut ngay và audit ghi cùng transaction. Ban GoTrue sau;
      // lỗi thì trả 502 để admin bấm lại (cả hai bước đều idempotent).
      const res = await deps.rpc('admin_set_suspended', {
        p_admin: adminId, p_user: target.user.id, p_suspend: suspend, p_reason: reason,
      })
      if (res.error) return rpcFailure(res.error)
      try {
        await deps.setBan(target.user.id, suspend)
      } catch (e) {
        console.error('setBan failed', String(e))
        return fail(502, 'ban_failed')
      }
      return ok({ suspended: suspend })
    }

    case 'revoke_keys': {
      const reason = readReason(body.reason)
      if (!reason) return fail(400, 'invalid_reason')
      const target = await loadTarget(deps, adminId, body.userId)
      if ('error' in target) return target.error
      const res = await deps.rpc('admin_revoke_user_keys', { p_admin: adminId, p_user: target.user.id, p_reason: reason })
      if (res.error) return rpcFailure(res.error)
      return ok({ revoked: res.data })
    }

    case 'list_audit': {
      const userId = body.userId ?? null
      if (userId !== null && (typeof userId !== 'string' || !UUID.test(userId))) return fail(400, 'invalid_user_id')
      const limit = Number.isInteger(body.limit) ? body.limit : 50
      const offset = Number.isInteger(body.offset) ? body.offset : 0
      const res = await deps.rpc('admin_list_audit', { p_user: userId, p_limit: limit, p_offset: offset })
      if (res.error) return rpcFailure(res.error)
      return ok({ entries: res.data })
    }

    default:
      return fail(400, 'unknown_action')
  }
}
