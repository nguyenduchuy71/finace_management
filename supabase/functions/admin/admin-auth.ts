// Xác thực người gọi function `admin`: JWT hợp lệ + app_metadata.role = 'admin' + MFA (aal2).
//
// app_metadata chỉ service role ghi được (user tự sửa user_metadata, không sửa app_metadata),
// nên role đọc từ GoTrue là đáng tin. aal nằm trong claim của access token: đọc payload SAU
// KHI getUser đã xác nhận token với GoTrue — không tự kiểm chữ ký.

import { bearerToken } from '../_shared/http.ts'

export type AdminAuthResult =
  | { ok: true; adminId: string }
  | { ok: false; status: 401 | 403; error: 'unauthorized' | 'forbidden' | 'mfa_required' }

/** Tối thiểu của GoTrue User mà phần xác thực cần. */
export type GoTrueUser = { id: string; app_metadata?: Record<string, unknown> }

export type GetUser = (token: string) =>
  PromiseLike<{ data: { user: GoTrueUser | null }; error: unknown }>

export { bearerToken }

/** Claim `aal` của JWT ('aal1' | 'aal2'), null nếu không đọc được. */
export function tokenAal(token: string): string | null {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
    const aal = JSON.parse(json)?.aal
    return typeof aal === 'string' ? aal : null
  } catch {
    return null
  }
}

export const isAdminUser = (u: GoTrueUser | null | undefined) => u?.app_metadata?.role === 'admin'

export async function requireAdmin(token: string | null, getUser: GetUser): Promise<AdminAuthResult> {
  if (!token) return { ok: false, status: 401, error: 'unauthorized' }
  const { data, error } = await getUser(token)
  if (error || !data.user) return { ok: false, status: 401, error: 'unauthorized' }
  if (!isAdminUser(data.user)) return { ok: false, status: 403, error: 'forbidden' }
  // Mật khẩu admin lộ không đủ để chiếm quyền: bắt buộc đã qua bước TOTP trong phiên này.
  if (tokenAal(token) !== 'aal2') return { ok: false, status: 403, error: 'mfa_required' }
  return { ok: true, adminId: data.user.id }
}
