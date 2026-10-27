import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { supabase } from '@/lib/supabase'
import { adminKey, adminUser, auditEntry } from '@/test/fixtures/admin'
import { getAdminUser, listAdminUsers, listAudit, runAdminMutation } from './admin'

const invoke = vi.mocked(supabase.functions.invoke)
type InvokeResult = Awaited<ReturnType<typeof supabase.functions.invoke>>

/** Mô phỏng `functions.invoke` khi function trả HTTP lỗi: FunctionsHttpError mang Response ở `context`. */
function httpError(status: number, body: unknown): InvokeResult {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  })
  return { data: null, error } as unknown as InvokeResult
}

const ok = (data: unknown) => ({ data, error: null }) as unknown as InvokeResult

beforeEach(() => {
  invoke.mockReset()
  // toAdminError log mã lỗi; im lặng và kiểm tra việc log ở test riêng.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('gọi function admin: body đúng action', () => {
  it('listAdminUsers gửi list_users và trả mảng users', async () => {
    invoke.mockResolvedValue(ok({ users: [adminUser({ id: 'u1' })] }))
    const users = await listAdminUsers()
    expect(invoke).toHaveBeenCalledWith('admin', { body: { action: 'list_users' } })
    expect(users.map((u) => u.id)).toEqual(['u1'])
  })

  it('getAdminUser gửi get_user kèm userId và tách user/keys', async () => {
    invoke.mockResolvedValue(ok({ user: adminUser({ id: 'u1' }), keys: [adminKey({ id: 'k1' })] }))
    const r = await getAdminUser('u1')
    expect(invoke).toHaveBeenCalledWith('admin', { body: { action: 'get_user', userId: 'u1' } })
    expect(r.keys[0].id).toBe('k1')
  })

  it('runAdminMutation gửi đúng action, userId và lý do (không đổi lý do ở service)', async () => {
    invoke.mockResolvedValue(ok({ ok: true }))
    await runAdminMutation('suspend', 'u1', 'lý do đủ dài')
    expect(invoke).toHaveBeenCalledWith('admin', {
      body: { action: 'suspend', userId: 'u1', reason: 'lý do đủ dài' },
    })
  })

  it('listAudit gửi list_audit, limit 200 (toàn hệ thống, không còn lọc theo user)', async () => {
    invoke.mockResolvedValue(ok({ entries: [auditEntry({ id: 1 })] }))
    const entries = await listAudit()
    expect(invoke).toHaveBeenCalledWith('admin', { body: { action: 'list_audit', limit: 200 } })
    expect(entries).toHaveLength(1)
  })
})

const INVALID_RESPONSE = { code: 'invalid_response', message: 'Phản hồi không đúng định dạng. Vui lòng thử lại.' }

describe('Zod ở biên service: response sai -> ApiError invalid_response (không lộ ZodError)', () => {
  it('response sai hình dạng -> invalid_response, KHÔNG ném ZodError ra UI', async () => {
    invoke.mockResolvedValue(ok({ users: [{ id: 'u1' }] }))
    const err = await listAdminUsers().catch((e) => e)
    expect(err).toEqual(INVALID_RESPONSE)
    expect(err).not.toBeInstanceOf(z.ZodError)
  })

  it('field ngoài schema (vd raw_text, amount nếu server lỡ trả) bị loại khỏi kết quả', async () => {
    const leaked = { ...adminUser({ id: 'u1' }), raw_text: 'số dư 12.000.000', amount: 500000 }
    invoke.mockResolvedValue(ok({ users: [leaked] }))
    const [user] = await listAdminUsers()
    expect(user).not.toHaveProperty('raw_text')
    expect(user).not.toHaveProperty('amount')
  })

  it('timestamp không có offset bị từ chối -> invalid_response', async () => {
    invoke.mockResolvedValue(ok({ users: [adminUser({ id: 'u1', createdAt: '2026-10-01T10:00:00' })] }))
    await expect(listAdminUsers()).rejects.toEqual(INVALID_RESPONSE)
  })

  it('action audit lạ bị từ chối -> invalid_response', async () => {
    invoke.mockResolvedValue(ok({ entries: [{ ...auditEntry({ id: 1 }), action: 'drop_table' }] }))
    await expect(listAudit()).rejects.toEqual(INVALID_RESPONSE)
  })

  it('getAdminUser thiếu keys -> invalid_response', async () => {
    invoke.mockResolvedValue(ok({ user: adminUser({ id: 'u1' }) }))
    await expect(getAdminUser('u1')).rejects.toEqual(INVALID_RESPONSE)
  })
})

describe('lỗi function -> ApiError (code + message tiếng Việt)', () => {
  it('403 mfa_required -> code MFA_REQUIRED (UI quay về màn nhập TOTP)', async () => {
    invoke.mockResolvedValue(httpError(403, { error: 'mfa_required' }))
    await expect(listAdminUsers()).rejects.toEqual({
      code: 'MFA_REQUIRED',
      message: 'Cần xác thực hai lớp (mã TOTP) để tiếp tục.',
    })
  })

  it('403 forbidden -> code forbidden và thông điệp quyền', async () => {
    invoke.mockResolvedValue(httpError(403, { error: 'forbidden' }))
    await expect(listAdminUsers()).rejects.toEqual({
      code: 'forbidden',
      message: 'Tài khoản này không có quyền quản trị.',
    })
  })

  it('ban_failed -> code ban_failed + thông điệp chung (dialog thay bằng thông điệp theo chiều khoá/mở khoá)', async () => {
    invoke.mockResolvedValue(httpError(500, { error: 'ban_failed' }))
    const err = await runAdminMutation('suspend', 'u1', 'lý do đủ dài').catch((e) => e)
    expect(err.code).toBe('ban_failed')
    expect(err.message).toContain('hoàn tất một phần')
  })

  it('invalid_reason và cannot_target_self có thông điệp riêng', async () => {
    invoke.mockResolvedValue(httpError(400, { error: 'invalid_reason' }))
    await expect(runAdminMutation('suspend', 'u1', 'abc')).rejects.toMatchObject({
      code: 'invalid_reason', message: 'Lý do phải từ 5 đến 500 ký tự.',
    })
    invoke.mockResolvedValue(httpError(400, { error: 'cannot_target_self' }))
    await expect(runAdminMutation('suspend', 'me', 'lý do đủ dài')).rejects.toMatchObject({
      code: 'cannot_target_self', message: 'Không thể thao tác lên chính tài khoản của bạn.',
    })
  })

  it('mã lạ -> giữ nguyên code, thông điệp chung', async () => {
    invoke.mockResolvedValue(httpError(500, { error: 'something_new' }))
    await expect(listAdminUsers()).rejects.toEqual({
      code: 'something_new',
      message: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    })
  })

  it('body không phải JSON -> code internal error', async () => {
    invoke.mockResolvedValue(httpError(502, '<html>bad gateway</html>'))
    await expect(listAdminUsers()).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('body JSON nhưng error không phải chuỗi -> code internal error', async () => {
    invoke.mockResolvedValue(httpError(500, { error: { nested: true } }))
    await expect(listAdminUsers()).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('lỗi không có context Response (vd mất mạng) -> internal error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') } as unknown as InvokeResult)
    await expect(listAdminUsers()).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('invoke ném exception (không trả error) -> vẫn map sang ApiError', async () => {
    invoke.mockRejectedValue(new TypeError('network down'))
    await expect(getAdminUser('u1')).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('ghi log chỉ mã lỗi (không kèm body/PII)', async () => {
    invoke.mockResolvedValue(httpError(403, { error: 'forbidden', email: 'x@y.z' }))
    await expect(listAdminUsers()).rejects.toBeTruthy()
    expect(console.error).toHaveBeenCalledWith('[admin]', 'forbidden')
  })
})
