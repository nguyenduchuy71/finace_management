import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ApiError } from '@/types/api'
import { CreditLedgerEntrySchema, type CreditLedgerEntry } from '@/types/credit'
import {
  AdminUserSchema, AuditActionSchema,
  type AdminKey, type AdminMutation, type AdminUser, type AuditEntry,
} from '@/types/admin'

const iso = z.string().datetime({ offset: true })

// Response của function `admin` giữ snake_case ở `keys` / `entries` (cột DB); đổi sang camelCase tại biên
// như mọi service khác (CLAUDE.md quyết định 4). `user` đã là camelCase (function tự dựng).
const AdminKeyWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  last4: z.string(),
  created_at: iso,
  last_used_at: iso.nullable(),
  revoked_at: iso.nullable(),
}).transform((k): AdminKey => ({
  id: k.id, name: k.name, prefix: k.prefix, last4: k.last4,
  createdAt: k.created_at, lastUsedAt: k.last_used_at, revokedAt: k.revoked_at,
}))

// Dòng sổ cái từ RPC admin_user_ledger (snake_case).
const LedgerWireSchema = z.object({
  id: z.number().int(), delta: z.number().int(), kind: CreditLedgerEntrySchema.shape.kind, created_at: iso,
}).transform((l): CreditLedgerEntry => ({ id: l.id, delta: l.delta, kind: l.kind, createdAt: l.created_at }))

const AuditEntryWireSchema = z.object({
  id: z.number().int(),
  admin_id: z.string(),
  action: AuditActionSchema,
  target_user_id: z.string().nullable(),
  reason: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: iso,
}).transform((e): AuditEntry => ({
  id: e.id, adminId: e.admin_id, action: e.action, targetUserId: e.target_user_id,
  reason: e.reason, payload: e.payload, createdAt: e.created_at,
}))

/**
 * Thông điệp theo mã lỗi function `admin`. MFA_REQUIRED để UI quay về màn nhập mã TOTP
 * (vd phiên aal2 hết hạn, đăng nhập lại chỉ được aal1).
 */
const ADMIN_ERRORS: Record<string, string> = {
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Tài khoản này không có quyền quản trị.',
  mfa_required: 'Cần xác thực hai lớp (mã TOTP) để tiếp tục.',
  invalid_reason: 'Lý do phải từ 5 đến 500 ký tự.',
  invalid_user_id: 'Mã user không hợp lệ.',
  user_not_found: 'Không tìm thấy user (có thể đã bị xoá).',
  cannot_target_self: 'Không thể thao tác lên chính tài khoản của bạn.',
  cannot_target_admin: 'Không thể thao tác lên tài khoản quản trị khác.',
  invalid_delta: 'Số credit phải là số nguyên khác 0 (tối đa ±1.000.000).',
  insufficient_credit: 'Số dư không đủ để trừ.',
  // Thông điệp chung; AdminActionDialog thay bằng thông điệp theo đúng chiều khoá / mở khoá.
  ban_failed: 'Thao tác mới hoàn tất một phần (chưa cập nhật trạng thái đăng nhập). Bấm lại để hoàn tất.',
}

/** Lỗi HTTP của functions.invoke mang Response gốc ở `context` — đọc mã lỗi từ body JSON. */
async function toAdminError(error: unknown): Promise<ApiError> {
  let code = 'internal_error'
  const context = (error as { context?: unknown })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (typeof body?.error === 'string') code = body.error
    } catch {
      // body không phải JSON -> giữ mã chung
    }
  }
  console.error('[admin]', code)
  return {
    code: code === 'mfa_required' ? 'MFA_REQUIRED' : code,
    message: ADMIN_ERRORS[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  }
}

async function call<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  let res: { data: unknown; error: unknown }
  try {
    res = await supabase.functions.invoke('admin', { body })
  } catch (e) {
    // invoke có thể throw khi mất mạng.
    throw await toAdminError(e)
  }
  if (res.error) throw await toAdminError(res.error)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) {
    // Không hiện ZodError ra UI (chuỗi JSON tiếng Anh, tên trường nội bộ).
    console.error('[admin] invalid response', parsed.error.issues)
    const apiError: ApiError = { code: 'invalid_response', message: 'Phản hồi không đúng định dạng. Vui lòng thử lại.' }
    throw apiError
  }
  return parsed.data
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const r = await call({ action: 'list_users' }, z.object({ users: z.array(AdminUserSchema) }))
  return r.users
}

/** Mỗi lần gọi ghi 1 dòng audit `view_user` ở server — đừng gọi lặp vô cớ. */
export async function getAdminUser(
  userId: string,
): Promise<{ user: AdminUser; keys: AdminKey[]; ledger?: CreditLedgerEntry[] }> {
  return call({ action: 'get_user', userId }, z.object({
    user: AdminUserSchema, keys: z.array(AdminKeyWireSchema), ledger: z.array(LedgerWireSchema).default([]),
  }))
}

/** Cộng/trừ credit (delta nguyên ≠ 0), ghi audit cùng transaction. Trả số dư mới. */
export async function adjustAdminCredit(userId: string, delta: number, reason: string): Promise<number> {
  const r = await call({ action: 'adjust_credit', userId, delta, reason }, z.object({ balance: z.number().int() }))
  return r.balance
}

export async function runAdminMutation(action: AdminMutation, userId: string, reason: string): Promise<void> {
  await call({ action, userId, reason }, z.record(z.string(), z.unknown()))
}

/** 200 dòng mới nhất toàn hệ thống (function hỗ trợ lọc theo user, UI chưa cần — YAGNI). */
export async function listAudit(): Promise<AuditEntry[]> {
  const r = await call({ action: 'list_audit', limit: 200 }, z.object({ entries: z.array(AuditEntryWireSchema) }))
  return r.entries
}
