import type { Session } from '@supabase/supabase-js'
import type { AdminKey, AdminUser, AuditEntry } from '@/types/admin'

/** User mặc định: đang hoạt động, có 1 key còn hiệu lực. Ghi đè từng trường khi cần. */
export const adminUser = (over: Partial<AdminUser> & { id: string }): AdminUser => ({
  email: `${over.id}@local.dev`,
  isAdmin: false,
  createdAt: '2026-10-01T10:00:00Z',
  lastSignInAt: null,
  bannedUntil: null,
  suspendedAt: null,
  suspendedReason: null,
  consentAt: null,
  keysActive: 1,
  keysLastUsedAt: null,
  txCount30d: 0,
  unparsed30d: {},
  parseRate30d: null,
  ...over,
})

export const adminKey = (over: Partial<AdminKey> & { id: string }): AdminKey => ({
  name: 'iPhone',
  prefix: 'vj_abc123',
  last4: 'Wxyz',
  created_at: '2026-10-01T10:00:00Z',
  last_used_at: null,
  revoked_at: null,
  ...over,
})

export const auditEntry = (over: Partial<AuditEntry> & { id: number }): AuditEntry => ({
  admin_id: 'admin-1',
  action: 'suspend',
  target_user_id: 'u1',
  reason: 'lý do kiểm thử',
  payload: {},
  created_at: '2026-10-20T08:00:00Z',
  ...over,
})

/** Session tối giản: chỉ app_metadata và user.id được code đọc. */
export const sessionWithRole = (role: string | undefined): Session =>
  ({
    access_token: 'token',
    user: { id: 'me', app_metadata: role === undefined ? {} : { role } },
  }) as unknown as Session
