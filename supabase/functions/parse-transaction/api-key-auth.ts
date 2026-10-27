// Xác định user gọi function: API key theo user (Authorization: Bearer vj_…) hoặc
// đường legacy single-tenant (x-shortcut-secret -> DEFAULT_USER_ID) giữ tới phase 4.

import { secretMatches } from './shortcut-auth.ts'
import { normalizeOwnerNames } from './internal-transfer.ts'

export type Caller = { userId: string; ownerNames: string[] }

export type AuthResult =
  | { ok: true; caller: Caller }
  | { ok: false; status: 401 | 403 | 429 | 500; error: string }

/** Dòng trả về của RPC `authenticate_api_key` (0 dòng = key sai / đã thu hồi). */
export type AuthenticateRow = {
  user_id: string; owner_names: (string | null)[] | null; rate_limited: boolean
  /** Admin đã khoá user (user_settings.suspended_at). */
  suspended: boolean
}

/** Gọi RPC bằng service role — tiêm vào để test không cần DB. */
export type AuthenticateRpc = (keyHashHex: string) =>
  PromiseLike<{ data: AuthenticateRow[] | null; error: { message: string } | null }>

export type LegacyConfig = {
  secret?: string; userId?: string; ownerNames: string[]
  /**
   * Admin có thể khoá cả user của đường legacy (DEFAULT_USER_ID) — đúng lúc cần khoá nhất là khi
   * secret chung bị lộ. Thiếu hàm này thì legacy bị TỪ CHỐI (fail closed), không bỏ qua kiểm khoá.
   */
  isSuspended?: (userId: string) => PromiseLike<boolean>
}

/** Khớp định dạng do `create_api_key` sinh: 'vj_' + 32 byte base64url không padding. */
const KEY_FORMAT = /^vj_[A-Za-z0-9_-]{43}$/

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function bearerToken(headers: Headers): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '')
  return m ? m[1] : null
}

export async function resolveCaller(
  headers: Headers, authenticate: AuthenticateRpc, legacy: LegacyConfig,
): Promise<AuthResult> {
  const key = bearerToken(headers)
  if (key !== null) {
    // Sai định dạng -> 401 luôn, khỏi tốn 1 lượt DB cho rác.
    if (!KEY_FORMAT.test(key)) return { ok: false, status: 401, error: 'unauthorized' }
    // Chỉ hash đi vào DB, plaintext key không rời function.
    const { data, error } = await authenticate(await sha256Hex(key))
    if (error) {
      console.error('authenticate_api_key failed', error.message)
      return { ok: false, status: 500, error: 'auth unavailable' }
    }
    const row = data?.[0]
    if (!row) return { ok: false, status: 401, error: 'unauthorized' }
    // Khoá trước rate limit: user bị khoá thì lý do từ chối là khoá, không phải "gửi nhiều quá".
    // Tin bị từ chối KHÔNG được lưu (khác hết credit) — user đã bị khoá.
    if (row.suspended) return { ok: false, status: 403, error: 'suspended' }
    if (row.rate_limited) return { ok: false, status: 429, error: 'rate limited' }
    // User gõ tên tự nhiên ("Nguyễn Đức Huy") còn mô tả giao dịch đã bỏ dấu + in hoa:
    // phải chuẩn hoá như đường env, không thì chuyển nội bộ không bao giờ được nhận ra.
    return { ok: true, caller: { userId: row.user_id, ownerNames: normalizeOwnerNames(row.owner_names ?? []) } }
  }

  // Legacy: chỉ khi CẢ secret và user id được cấu hình (gỡ ở phase 4).
  if (legacy.secret && legacy.userId &&
      await secretMatches(headers.get('x-shortcut-secret'), legacy.secret)) {
    if (!legacy.isSuspended) return { ok: false, status: 500, error: 'auth unavailable' }
    try {
      if (await legacy.isSuspended(legacy.userId)) return { ok: false, status: 403, error: 'suspended' }
    } catch (e) {
      console.error('legacy suspended check failed', String(e))
      return { ok: false, status: 500, error: 'auth unavailable' }
    }
    return { ok: true, caller: { userId: legacy.userId, ownerNames: legacy.ownerNames } }
  }
  return { ok: false, status: 401, error: 'unauthorized' }
}
