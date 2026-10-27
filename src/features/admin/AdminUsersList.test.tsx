import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getAdminUser, listAdminUsers } from '@/services/admin'
import { adminKey, adminUser } from '@/test/fixtures/admin'
import { SuspensionBadge } from './SuspensionBadge'
import { AdminUsersList } from './AdminUsersList'

const FUTURE = '2126-01-01T00:00:00Z'

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<AdminUsersList />, { wrapper })
}

/** Nút của dòng user: phần tử hiển thị email (text riêng, khớp đủ) -> nút bao ngoài. */
const rowOf = async (email: string) => {
  const btn = (await screen.findByText(email)).closest('button')
  if (!btn) throw new Error(`không thấy dòng ${email}`)
  return btn
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAdminUser).mockResolvedValue({ user: adminUser({ id: 'x' }), keys: [] })
})

describe('SuspensionBadge', () => {
  it('ba trạng thái hiển thị đúng nhãn', () => {
    const now = new Date().toISOString()
    const { rerender } = render(<SuspensionBadge user={{ suspendedAt: null, bannedUntil: null }} />)
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    rerender(<SuspensionBadge user={{ suspendedAt: now, bannedUntil: FUTURE }} />)
    expect(screen.getByText('Bị khoá')).toBeInTheDocument()
    rerender(<SuspensionBadge user={{ suspendedAt: now, bannedUntil: null }} />)
    expect(screen.getByText('Lệch trạng thái')).toBeInTheDocument()
  })
})

describe('AdminUsersList — danh sách', () => {
  it('hiện email, nhãn quản trị, số key, số giao dịch và trạng thái từng user', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      adminUser({ id: 'u1', email: 'a@local.dev', keysActive: 2, txCount30d: 17, parseRate30d: 0.5 }),
      adminUser({ id: 'u2', email: 'b@local.dev', suspendedAt: '2026-10-20T00:00:00Z', bannedUntil: FUTURE }),
      adminUser({ id: 'a1', email: 'boss@local.dev', isAdmin: true }),
    ])
    renderList()

    const a = await rowOf('a@local.dev')
    expect(within(a).getByText(/2 key/)).toBeInTheDocument()
    expect(within(a).getByText('17')).toBeInTheDocument()
    expect(within(a).getByText(/parse 50%/)).toBeInTheDocument()
    expect(within(a).getByText('Hoạt động')).toBeInTheDocument()

    expect(within(await rowOf('b@local.dev')).getByText('Bị khoá')).toBeInTheDocument()
    expect(within(await rowOf('boss@local.dev')).getByText('quản trị')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^User/ })).toHaveTextContent('(3)')
  })

  it('hiển thị "chưa đăng nhập" khi chưa có lần đăng nhập nào', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev', lastSignInAt: null })])
    renderList()
    expect(within(await rowOf('a@local.dev')).getByText(/chưa đăng nhập/)).toBeInTheDocument()
  })

  it('tìm theo email: không phân biệt hoa thường, lọc đúng', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      adminUser({ id: 'u1', email: 'an.nguyen@local.dev' }),
      adminUser({ id: 'u2', email: 'binh.tran@local.dev' }),
    ])
    renderList()
    await rowOf('an.nguyen@local.dev')
    fireEvent.change(screen.getByLabelText('Tìm theo email'), { target: { value: '  BINH ' } })
    expect(screen.queryByText(/an\.nguyen@local\.dev/)).toBeNull()
    expect(screen.getByText(/binh\.tran@local\.dev/)).toBeInTheDocument()
  })

  it('không khớp -> thông báo; danh sách rỗng -> "Chưa có user."', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([])
    renderList()
    expect(await screen.findByText('Chưa có user.')).toBeInTheDocument()
  })

  it('tìm không khớp -> "Không có user khớp."', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev' })])
    renderList()
    await rowOf('a@local.dev')
    fireEvent.change(screen.getByLabelText('Tìm theo email'), { target: { value: 'zzz' } })
    expect(screen.getByText('Không có user khớp.')).toBeInTheDocument()
  })

  it('lỗi tải -> thông điệp + Thử lại gọi lại danh sách', async () => {
    vi.mocked(listAdminUsers).mockRejectedValueOnce({ code: 'MFA_REQUIRED', message: 'Cần xác thực hai lớp (mã TOTP) để tiếp tục.' })
    renderList()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Cần xác thực hai lớp')

    vi.mocked(listAdminUsers).mockResolvedValueOnce([adminUser({ id: 'u1', email: 'a@local.dev' })])
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    await rowOf('a@local.dev')
    expect(listAdminUsers).toHaveBeenCalledTimes(2)
  })
})

describe('AdminUsersList — mở chi tiết', () => {
  it('bấm dòng user -> mở dialog chi tiết với get_user đúng id và danh sách key', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u7', email: 'c@local.dev' })])
    vi.mocked(getAdminUser).mockResolvedValue({
      user: adminUser({ id: 'u7', email: 'c@local.dev' }),
      keys: [adminKey({ id: 'k1', name: 'iPad' })],
    })
    renderList()
    fireEvent.click(await rowOf('c@local.dev'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('iPad')).toBeInTheDocument()
    expect(getAdminUser).toHaveBeenCalledWith('u7')
  })

  it('danh sách không tự gọi get_user (không ghi audit view_user khi chỉ xem danh sách)', async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev' })])
    renderList()
    await rowOf('a@local.dev')
    await waitFor(() => expect(listAdminUsers).toHaveBeenCalled())
    expect(getAdminUser).not.toHaveBeenCalled()
  })
})
