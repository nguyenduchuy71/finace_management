import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * MFA TOTP cho admin. `supabase.auth.*` là auth (ngoại lệ của service layer, CLAUDE.md) nên nằm
 * trong features/auth. Gom vào 1 module để component test mock được.
 */

/** Role admin chỉ service role ghi được (app_metadata). Đây chỉ để ẩn/hiện UI — quyền thật kiểm ở function. */
export function isAdminSession(session: Session | null): boolean {
  return session?.user.app_metadata?.role === 'admin'
}

export type MfaStatus =
  | { step: 'verified' }                       // phiên đã aal2
  | { step: 'challenge'; factorId: string }    // có TOTP, cần nhập mã
  | { step: 'enroll' }                         // chưa có TOTP

export async function getMfaStatus(): Promise<MfaStatus> {
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal.error) throw aal.error
  if (aal.data.currentLevel === 'aal2') return { step: 'verified' }
  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) throw factors.error
  // `totp` chỉ gồm factor đã verify; factor chưa verify (enroll dở) không dùng để challenge được.
  const totp = factors.data.totp[0]
  return totp ? { step: 'challenge', factorId: totp.id } : { step: 'enroll' }
}

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string }

/**
 * Bắt đầu đăng ký TOTP. Xoá factor TOTP chưa verify còn sót (đóng tab giữa chừng) trước —
 * GoTrue không cho 2 factor trùng tên, và factor dở không có ích gì.
 */
export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) throw factors.error
  for (const f of factors.data.all) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (error) throw error
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Quản trị' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Đúng mã -> phiên lên aal2 (onAuthStateChange phát sự kiện, session mới có claim aal2). */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}
