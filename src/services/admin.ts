import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ApiError } from '@/types/api'
import {
  AdminKeySchema, AdminUserSchema, AuditEntrySchema,
  type AdminKey, type AdminMutation, type AdminUser, type AuditEntry,
} from '@/types/admin'

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
export async function getAdminUser(userId: string): Promise<{ user: AdminUser; keys: AdminKey[] }> {
  return call({ action: 'get_user', userId }, z.object({ user: AdminUserSchema, keys: z.array(AdminKeySchema) }))
}

export async function runAdminMutation(action: AdminMutation, userId: string, reason: string): Promise<void> {
  await call({ action, userId, reason }, z.record(z.string(), z.unknown()))
}

/** 200 dòng mới nhất toàn hệ thống (function hỗ trợ lọc theo user, UI chưa cần — YAGNI). */
export async function listAudit(): Promise<AuditEntry[]> {
  const r = await call({ action: 'list_audit', limit: 200 }, z.object({ entries: z.array(AuditEntrySchema) }))
  return r.entries
}
