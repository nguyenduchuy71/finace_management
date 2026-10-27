import { z } from 'zod'

/**
 * Dữ liệu trang quản trị — CHỈ metadata (function `admin` không trả số tiền, mô tả, raw_text).
 * Schema khớp response của supabase/functions/admin/admin-actions.ts.
 */
const iso = z.string().datetime({ offset: true })

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: iso,
  lastSignInAt: iso.nullable(),
  /** Ban GoTrue (chặn đăng nhập). Lệch với suspendedAt = khoá dở dang -> bấm khoá lại. */
  bannedUntil: iso.nullable(),
  suspendedAt: iso.nullable(),
  suspendedReason: z.string().nullable(),
  consentAt: iso.nullable(),
  keysActive: z.number().int(),
  keysLastUsedAt: iso.nullable(),
  txCount30d: z.number().int(),
  unparsed30d: z.record(z.string(), z.number().int()),
  parseRate30d: z.number().nullable(),
})
export type AdminUser = z.infer<typeof AdminUserSchema>

export const AdminKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  last4: z.string(),
  created_at: iso,
  last_used_at: iso.nullable(),
  revoked_at: iso.nullable(),
})
export type AdminKey = z.infer<typeof AdminKeySchema>

export const AuditActionSchema = z.enum(['suspend', 'unsuspend', 'revoke_keys', 'view_user'])
export type AuditAction = z.infer<typeof AuditActionSchema>

export const AuditEntrySchema = z.object({
  id: z.number().int(),
  admin_id: z.string(),
  action: AuditActionSchema,
  target_user_id: z.string().nullable(),
  reason: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: iso,
})
export type AuditEntry = z.infer<typeof AuditEntrySchema>

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  suspend: 'Khoá',
  unsuspend: 'Mở khoá',
  revoke_keys: 'Thu hồi key',
  view_user: 'Xem chi tiết',
}

/** Hành động admin thay đổi user — mỗi cái bắt lý do. */
export type AdminMutation = 'suspend' | 'unsuspend' | 'revoke_keys'

/** Khớp kiểm ở function + CHECK admin_audit_log.reason. */
export const ADMIN_REASON_LENGTH = { min: 5, max: 500 } as const

/** Trạng thái khoá: DB và GoTrue phải cùng chiều; lệch = thao tác trước lỗi giữa chừng. */
export function suspensionState(u: Pick<AdminUser, 'suspendedAt' | 'bannedUntil'>, nowISO: string) {
  // So sánh thời điểm, không so chuỗi: GoTrue trả 'Z', Postgres trả '+00:00'.
  const banned = u.bannedUntil !== null && Date.parse(u.bannedUntil) > Date.parse(nowISO)
  const flagged = u.suspendedAt !== null
  if (flagged && banned) return 'suspended' as const
  if (!flagged && !banned) return 'active' as const
  return 'mismatch' as const
}

export function formatParseRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}
