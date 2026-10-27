import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteMyAccount } from './account-deletion'

const sb = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
  auth: { signOut: vi.fn() },
}))

vi.mock('@/lib/supabase', () => ({ supabase: sb }))

const GENERIC = {
  code: 'DELETE_ACCOUNT_FAILED',
  message: 'Không xoá được tài khoản. Kiểm tra mạng rồi thử lại.',
}

beforeEach(() => {
  vi.clearAllMocks()
  sb.functions.invoke.mockReset()
  sb.auth.signOut.mockReset()
  sb.auth.signOut.mockResolvedValue({ error: null })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('deleteMyAccount', () => {
  it('gọi edge function delete-account bằng POST, KHÔNG gửi user id từ client', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: null })
    await deleteMyAccount()
    // Đúng 2 tham số, không body: function lấy user từ JWT của phiên.
    expect(sb.functions.invoke).toHaveBeenCalledTimes(1)
    expect(sb.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' })
  })

  it('đã xoá nhưng signOut lỗi -> vẫn coi là xoá thành công (không báo "không xoá được")', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: null })
    sb.auth.signOut.mockRejectedValue(new Error('storage blocked'))
    await expect(deleteMyAccount()).resolves.toBeUndefined()
  })

  it('thành công -> đăng xuất LOCAL (refresh token đã chết, không gọi server thu hồi)', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: null })
    await expect(deleteMyAccount()).resolves.toBeUndefined()
    expect(sb.auth.signOut).toHaveBeenCalledTimes(1)
    expect(sb.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('edge function trả error -> ApiError chung, KHÔNG đăng xuất', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } })
    await expect(deleteMyAccount()).rejects.toEqual(GENERIC)
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })

  it('mất mạng (invoke throw) -> ApiError chung, KHÔNG đăng xuất', async () => {
    sb.functions.invoke.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(deleteMyAccount()).rejects.toEqual(GENERIC)
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })

  it('ghi log lỗi kỹ thuật ra console cho dev', async () => {
    sb.functions.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(deleteMyAccount()).rejects.toEqual(GENERIC)
    expect(console.error).toHaveBeenCalledWith('[delete-account]', 'boom')
  })
})
