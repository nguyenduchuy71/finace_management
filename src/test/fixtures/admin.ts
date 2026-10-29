import type { Session } from '@supabase/supabase-js'
import type { AdminKey, AdminUser, AuditEntry } from '@/types/admin'
import type { AdminOrder } from '@/types/admin-orders'

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
  creditBalance: 100,
  creditUnlimited: false,
  ...over,
})

export const adminKey = (over: Partial<AdminKey> & { id: string }): AdminKey => ({
  name: 'iPhone',
  prefix: 'vj_abc123',
  last4: 'Wxyz',
  createdAt: '2026-10-01T10:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
  ...over,
})

export const auditEntry = (over: Partial<AuditEntry> & { id: number }): AuditEntry => ({
  adminId: 'admin-1',
  action: 'suspend',
  targetUserId: 'u1',
  reason: 'lý do kiểm thử',
  payload: {},
  createdAt: '2026-10-20T08:00:00Z',
  ...over,
})

/** Dạng response thật của function `admin` (snake_case) cho `keys` — dùng khi mock `functions.invoke`. */
export const adminKeyWire = (k: AdminKey) => ({
  id: k.id, name: k.name, prefix: k.prefix, last4: k.last4,
  created_at: k.createdAt, last_used_at: k.lastUsedAt, revoked_at: k.revokedAt,
})

/** Như adminKeyWire, cho `entries` của list_audit. */
export const auditEntryWire = (e: AuditEntry) => ({
  id: e.id, admin_id: e.adminId, action: e.action, target_user_id: e.targetUserId,
  reason: e.reason, payload: e.payload, created_at: e.createdAt,
})

/** Session tối giản: chỉ app_metadata và user.id được code đọc. */
export const sessionWithRole = (role: string | undefined): Session =>
  ({
    access_token: 'token',
    user: { id: 'me', app_metadata: role === undefined ? {} : { role } },
  }) as unknown as Session

/** Đơn thanh toán mặc định: lệch tiền, MoMo, 50.000đ = 500 credit. */
export const adminOrder = (over: Partial<AdminOrder> & { id: string }): AdminOrder => ({
  userId: 'u1',
  email: 'nguoi.dung@local.dev',
  provider: 'momo',
  providerOrderRef: `261030_${over.id}`,
  providerTxId: null,
  amountVnd: 50000,
  credits: 500,
  status: 'mismatch',
  createdAt: '2026-10-30T01:00:00Z',
  paidAt: null,
  lastCheckedAt: null,
  ...over,
})
