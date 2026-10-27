// Xác định user gọi function: API key theo user (Authorization: Bearer vj_…) hoặc
// đường legacy single-tenant (x-shortcut-secret -> DEFAULT_USER_ID) giữ tới phase 4.

import { secretMatches } from './shortcut-auth.ts'

export type Caller = { userId: string; ownerNames: string[] }

export type AuthResult =
  | { ok: true; caller: Caller }
  | { ok: false; status: 401 | 429 | 500; error: string }

/** Dòng trả về của RPC `authenticate_api_key` (0 dòng = key sai / đã thu hồi). */
export type AuthenticateRow = { user_id: string; owner_names: string[] | null; rate_limited: boolean }

/** Gọi RPC bằng service role — tiêm vào để test không cần DB. */
export type AuthenticateRpc = (keyHashHex: string) =>
  PromiseLike<{ data: AuthenticateRow[] | null; error: { message: string } | null }>

export type LegacyConfig = { secret?: string; userId?: string; ownerNames: string[] }

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
    if (row.rate_limited) return { ok: false, status: 429, error: 'rate limited' }
    return { ok: true, caller: { userId: row.user_id, ownerNames: row.owner_names ?? [] } }
  }

  // Legacy: chỉ khi CẢ secret và user id được cấu hình (gỡ ở phase 4).
  if (legacy.secret && legacy.userId &&
      await secretMatches(headers.get('x-shortcut-secret'), legacy.secret)) {
    return { ok: true, caller: { userId: legacy.userId, ownerNames: legacy.ownerNames } }
  }
  return { ok: false, status: 401, error: 'unauthorized' }
}
