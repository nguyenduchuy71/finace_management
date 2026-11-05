import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'

// Chỉ mock tầng service và module MFA; hook (useAdmin*, useIsAdmin) và AuthContext là THẬT.
vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
  listAdminOrders: vi.fn(),
  resolveAdminOrder: vi.fn(),
}))
vi.mock('@/features/auth/mfa', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/mfa')>()),
  getMfaStatus: vi.fn(),
  startTotpEnrollment: vi.fn(),
  verifyTotp: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { listAdminUsers, listAudit, getAdminUser, listAdminOrders } from '@/services/admin'
import { getMfaStatus } from '@/features/auth/mfa'
import { AuthContext } from '@/features/auth/AuthProvider'
import { adminOrder, adminUser, ordersResult, sessionWithRole } from '@/test/fixtures/admin'
import AdminPage from './AdminPage'

/** Route giống App.tsx: /admin (trang thật) và /accounts (đích chuyển hướng). */
function renderAt(role: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ session: sessionWithRole(role), loading: false }}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin']}>{children}</MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>
  )
  return render(
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/accounts" element={<p>TRANG NGÂN HÀNG</p>} />
    </Routes>,
    { wrapper },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMfaStatus).mockResolvedValue({ step: 'verified' })
  vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev' })])
  vi.mocked(listAudit).mockResolvedValue([])
  vi.mocked(listAdminOrders).mockResolvedValue(ordersResult([adminOrder({ id: 'm1' })]))
  vi.mocked(getAdminUser).mockResolvedValue({ user: adminUser({ id: 'u1' }), keys: [] })
})

describe('AdminPage — guard quyền', () => {
  it('user thường -> đưa về /accounts, không gọi MFA hay danh sách admin', async () => {
    renderAt('user')
    expect(await screen.findByText('TRANG NGÂN HÀNG')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quản trị' })).toBeNull()
    expect(getMfaStatus).not.toHaveBeenCalled()
    expect(listAdminUsers).not.toHaveBeenCalled()
  })

  it('không có role -> đưa về /accounts', async () => {
    renderAt('')
    expect(await screen.findByText('TRANG NGÂN HÀNG')).toBeInTheDocument()
    expect(listAdminUsers).not.toHaveBeenCalled()
  })
})

describe('AdminPage — admin', () => {
  it('admin aal2 -> tiêu đề, ba tab và danh sách user', async () => {
    renderAt('admin')
    expect(await screen.findByRole('heading', { name: 'Quản trị' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'User' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Đơn thanh toán' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nhật ký' })).toBeInTheDocument()
    expect(await screen.findByText('a@local.dev')).toBeInTheDocument()
  })

  it('MẶT THẬT chống render loop: mount xong, chờ rồi vẫn đúng 1 lần gọi mỗi endpoint', async () => {
    renderAt('admin')
    await screen.findByText('a@local.dev')
    await new Promise((r) => setTimeout(r, 300))
    expect(getMfaStatus).toHaveBeenCalledTimes(1)
    expect(listAdminUsers).toHaveBeenCalledTimes(1)
    // Lúc mount không mở dòng nào -> không gọi get_user (không ghi audit view_user thừa).
    expect(getAdminUser).not.toHaveBeenCalled()
    expect(listAudit).not.toHaveBeenCalled()
    expect(listAdminOrders).not.toHaveBeenCalled()
  })

  it('chuyển sang tab Nhật ký: tải audit 1 lần, KHÔNG tải lại danh sách user (cache còn mới)', async () => {
    renderAt('admin')
    await screen.findByText('a@local.dev')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Nhật ký' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('tab', { name: 'Nhật ký' }))
    expect(await screen.findByText('Chưa có thao tác nào.')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 200))
    expect(listAudit).toHaveBeenCalledTimes(1)
    expect(listAdminUsers).toHaveBeenCalledTimes(1)
  })

  it('tab Đơn thanh toán (mount thật): tải đúng 1 lần, hiện đơn, không gọi get_user và không tải lại user', async () => {
    renderAt('admin')
    await screen.findByText('a@local.dev')
    expect(listAdminOrders).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Đơn thanh toán' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('tab', { name: 'Đơn thanh toán' }))
    expect(await screen.findByText('261030_m1')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 300))
    expect(listAdminOrders).toHaveBeenCalledTimes(1)
    expect(listAdminOrders).toHaveBeenCalledWith({ status: null, provider: null })
    expect(getAdminUser).not.toHaveBeenCalled()
    expect(listAdminUsers).toHaveBeenCalledTimes(1)
  })

  it('chưa aal2 -> gate hiện form MFA, KHÔNG tải danh sách admin', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'challenge', factorId: 'f1' })
    renderAt('admin')
    expect(await screen.findByLabelText('Mã xác thực (6 số)')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'User' })).toBeNull()
    expect(listAdminUsers).not.toHaveBeenCalled()
  })

  it('chưa có factor -> gate hiện nút thiết lập, không tự enroll, không tải dữ liệu', async () => {
    vi.mocked(getMfaStatus).mockResolvedValue({ step: 'enroll' })
    renderAt('admin')
    expect(await screen.findByRole('button', { name: 'Bắt đầu thiết lập' })).toBeInTheDocument()
    expect(listAdminUsers).not.toHaveBeenCalled()
  })
})
