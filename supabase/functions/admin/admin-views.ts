// Dạng hiển thị (metadata) của user cho admin: ghép GoTrue + thống kê RPC. Tách khỏi admin-actions.ts cho gọn.

import { isAdminUser, type GoTrueUser } from './admin-auth.ts'

/** Các trường của GoTrue User mà admin được thấy. */
export type AuthUser = GoTrueUser & {
  email?: string
  created_at: string
  last_sign_in_at?: string | null
  banned_until?: string | null
}

export type StatsRow = {
  user_id: string
  suspended_at: string | null
  suspended_reason: string | null
  consent_at: string | null
  keys_active: number
  keys_last_used_at: string | null
  tx_count_30d: number
  unparsed_30d: Record<string, number>
  credit_balance: number
  credit_unlimited: boolean
}

/**
 * Tỉ lệ tin ghi thành giao dịch trên tin "trông như giao dịch" (bỏ OTP/promo vốn không lưu,
 * no_account là lỗi cấu hình TK của user chứ không phải parser). null khi chưa có tin nào.
 */
export function parseRate(tx: number, unparsed: Record<string, number>): number | null {
  const failed = (unparsed.no_match ?? 0) + (unparsed.invalid_parse ?? 0)
  return tx + failed === 0 ? null : Math.round((tx / (tx + failed)) * 1000) / 1000
}

export function toUserView(u: AuthUser, s: StatsRow | undefined) {
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
    creditBalance: s?.credit_balance ?? 0,
    creditUnlimited: s?.credit_unlimited ?? false,
  }
}
