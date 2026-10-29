import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getAdminUser, listAdminUsers, listAudit, runAdminMutation } from '@/services/admin'
import { toast } from 'sonner'
import { AuthContext } from '@/features/auth/AuthProvider'
import { adminKey, adminUser, sessionWithRole } from '@/test/fixtures/admin'
import { useAdminAudit, useAdminMutation, useAdminUser, useAdminUsers, useIsAdmin } from './useAdmin'

let client: QueryClient

function wrapperWith(session: ReturnType<typeof sessionWithRole> | null = null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ session, loading: false }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  client.clear()
  vi.restoreAllMocks()
})

/**
 * refetchOnWindowFocus chỉ refetch khi dữ liệu ĐÃ CŨ (staleTime 60s). Đẩy đồng hồ qua 60s
 * để kiểm đúng điều kiện thật: người dùng quay lại tab sau khi dữ liệu admin đã quá hạn.
 */
function ageDataPastStaleTime() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 61_000)
}

describe('refetchOnWindowFocus = false (get_user ghi audit mỗi lần gọi)', () => {
  it('đối chứng: query mặc định TỰ refetch khi focus — để chắc cơ chế focusManager có hiệu lực', async () => {
    let calls = 0
    const { result } = renderHook(() => useQuery({ queryKey: ['control'], queryFn: async () => ++calls }), {
      wrapper: wrapperWith(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    await waitFor(() => expect(calls).toBe(2))
  })

  it('useAdminUsers KHÔNG refetch khi focus lại cửa sổ', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1' })])
    const { result } = renderHook(() => useAdminUsers(), { wrapper: wrapperWith() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    ageDataPastStaleTime()
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    await new Promise((r) => setTimeout(r, 50))
    expect(listAdminUsers).toHaveBeenCalledTimes(1)
  })

  it('useAdminUser KHÔNG refetch khi focus lại (không ghi thêm audit view_user)', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ user: adminUser({ id: 'u1' }), keys: [] })
    const { result } = renderHook(() => useAdminUser('u1'), { wrapper: wrapperWith() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    ageDataPastStaleTime()
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    await new Promise((r) => setTimeout(r, 50))
    expect(getAdminUser).toHaveBeenCalledTimes(1)
  })
})

describe('query: không retry, đúng tham số', () => {
  it('lỗi MFA không retry: đúng 1 lần gọi trước khi báo lỗi', async () => {
    vi.mocked(listAdminUsers).mockRejectedValue({ code: 'MFA_REQUIRED', message: 'Cần xác thực' })
    const { result } = renderHook(() => useAdminUsers(), { wrapper: wrapperWith() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(listAdminUsers).toHaveBeenCalledTimes(1)
  })

  it('useAdminUser(null) không gọi get_user (query disabled)', async () => {
    renderHook(() => useAdminUser(null), { wrapper: wrapperWith() })
    await new Promise((r) => setTimeout(r, 20))
    expect(getAdminUser).not.toHaveBeenCalled()
  })

  it('useAdminUser(id) gọi get_user đúng id', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ user: adminUser({ id: 'u9' }), keys: [] })
    const { result } = renderHook(() => useAdminUser('u9'), { wrapper: wrapperWith() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getAdminUser).toHaveBeenCalledWith('u9')
  })

  it('useAdminAudit gọi listAudit (toàn hệ thống)', async () => {
    vi.mocked(listAudit).mockResolvedValue([])
    const { result } = renderHook(() => useAdminAudit(), { wrapper: wrapperWith() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(listAudit).toHaveBeenCalledTimes(1)
  })
})

describe('useAdminMutation — KHÔNG refetch get_user sau thao tác', () => {
  /** Mount đồng thời danh sách + chi tiết + mutation như trang thật. */
  function renderAdminScreen() {
    return renderHook(() => ({
      users: useAdminUsers(),
      audit: useAdminAudit(),
      detail: useAdminUser('u1'),
      mutation: useAdminMutation(),
    }), { wrapper: wrapperWith() })
  }

  it('khoá user: làm mới danh sách + nhật ký, chép trạng thái mới vào chi tiết, get_user KHÔNG gọi lại', async () => {
    const active = adminUser({ id: 'u1' })
    const suspended = adminUser({ id: 'u1', suspendedAt: '2026-10-27T10:00:00Z', bannedUntil: '2126-01-01T00:00:00Z' })
    vi.mocked(listAdminUsers).mockResolvedValueOnce([active]).mockResolvedValueOnce([suspended])
    vi.mocked(getAdminUser).mockResolvedValue({ user: active, keys: [adminKey({ id: 'k1' })] })
    vi.mocked(listAudit).mockResolvedValue([])

    const { result } = renderAdminScreen()
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.users.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.audit.isSuccess).toBe(true))
    expect(getAdminUser).toHaveBeenCalledTimes(1)
    const auditBefore = vi.mocked(listAudit).mock.calls.length

    await act(async () => {
      result.current.mutation.mutate({ action: 'suspend', userId: 'u1', reason: 'lý do đủ dài' })
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã khoá user'))

    expect(runAdminMutation).toHaveBeenCalledWith('suspend', 'u1', 'lý do đủ dài')
    expect(listAdminUsers).toHaveBeenCalledTimes(2)
    expect(vi.mocked(listAudit).mock.calls.length).toBeGreaterThan(auditBefore)
    expect(result.current.detail.data?.user.suspendedAt).toBe(suspended.suspendedAt)
    // Điểm then chốt: không refetch get_user (mỗi lần ghi audit view_user).
    expect(getAdminUser).toHaveBeenCalledTimes(1)
  })

  it('thu hồi key: key còn hiệu lực được đánh dấu revokedAt, key đã thu hồi giữ nguyên thời điểm cũ', async () => {
    const user = adminUser({ id: 'u1', keysActive: 1 })
    const keys = [
      adminKey({ id: 'k-active' }),
      adminKey({ id: 'k-old', revokedAt: '2026-10-01T00:00:00Z' }),
    ]
    vi.mocked(listAdminUsers).mockResolvedValue([{ ...user, keysActive: 0 }])
    vi.mocked(getAdminUser).mockResolvedValue({ user, keys })

    const { result } = renderAdminScreen()
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
    await act(async () => {
      result.current.mutation.mutate({ action: 'revoke_keys', userId: 'u1', reason: 'lý do đủ dài' })
    })
    await waitFor(() => expect(result.current.detail.data?.keys[0].revokedAt).not.toBeNull())

    expect(result.current.detail.data?.keys[0].revokedAt).toEqual(expect.any(String))
    expect(result.current.detail.data?.keys[1].revokedAt).toBe('2026-10-01T00:00:00Z')
    expect(getAdminUser).toHaveBeenCalledTimes(1)
  })

  it('mở khoá: không đụng key, vẫn không gọi lại get_user', async () => {
    const suspended = adminUser({ id: 'u1', suspendedAt: '2026-10-27T10:00:00Z', bannedUntil: '2126-01-01T00:00:00Z' })
    const cleared = adminUser({ id: 'u1' })
    vi.mocked(listAdminUsers).mockResolvedValueOnce([suspended]).mockResolvedValueOnce([cleared])
    vi.mocked(getAdminUser).mockResolvedValue({ user: suspended, keys: [adminKey({ id: 'k1' })] })

    const { result } = renderAdminScreen()
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
    await act(async () => {
      result.current.mutation.mutate({ action: 'unsuspend', userId: 'u1', reason: 'đã xác minh' })
    })
    await waitFor(() => expect(result.current.detail.data?.user.suspendedAt).toBeNull())
    expect(result.current.detail.data?.keys[0].revokedAt).toBeNull()
    expect(getAdminUser).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Đã mở khoá user')
  })

  it('lỗi ban_failed: không toast thành công, vẫn làm mới danh sách để thấy trạng thái lệch', async () => {
    vi.mocked(runAdminMutation).mockRejectedValue({ code: 'ban_failed', message: 'lệch' })
    const { result } = renderAdminScreen()
    await waitFor(() => expect(result.current.users.isSuccess).toBe(true))
    const usersBefore = vi.mocked(listAdminUsers).mock.calls.length

    await act(async () => {
      result.current.mutation.mutate({ action: 'suspend', userId: 'u1', reason: 'lý do đủ dài' })
    })
    await waitFor(() => expect(result.current.mutation.isError).toBe(true))
    await waitFor(() => expect(vi.mocked(listAdminUsers).mock.calls.length).toBeGreaterThan(usersBefore))
    expect(toast.success).not.toHaveBeenCalled()
    expect(getAdminUser).toHaveBeenCalledTimes(1)
  })
})

describe('useIsAdmin', () => {
  it('admin -> true; user thường, không có session -> false', () => {
    expect(renderHook(() => useIsAdmin(), { wrapper: wrapperWith(sessionWithRole('admin')) }).result.current).toBe(true)
    expect(renderHook(() => useIsAdmin(), { wrapper: wrapperWith(sessionWithRole('user')) }).result.current).toBe(false)
    expect(renderHook(() => useIsAdmin(), { wrapper: wrapperWith(null) }).result.current).toBe(false)
  })
})
