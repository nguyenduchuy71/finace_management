import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getAdminUser } from '@/services/admin'
import { adminKey, adminUser } from '@/test/fixtures/admin'
import type { AdminUser } from '@/types/admin'
import { AdminUserDialog } from './AdminUserDialog'

const FUTURE = '2126-01-01T00:00:00Z'
const PAST_SUSPEND = '2026-10-20T08:00:00Z'

function renderDialog(user: AdminUser, keys = [adminKey({ id: 'k1' })]) {
  vi.mocked(getAdminUser).mockResolvedValue({ user, keys })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const onClose = vi.fn()
  render(<AdminUserDialog user={user} onClose={onClose} />, { wrapper })
  return { onClose }
}

/** Các nút thao tác trong dialog (không tính nút đóng mặc định của Radix). */
const actionButtons = () => ['Khoá', 'Mở khoá', 'Thu hồi mọi key']
  .map((name) => ({ name, el: screen.queryByRole('button', { name }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminUserDialog — quyền thao tác', () => {
  it('tài khoản admin khác -> KHÔNG có nút thao tác nào, chỉ có thông báo', async () => {
    renderDialog(adminUser({ id: 'admin-2', isAdmin: true }))
    expect(await screen.findByText(/Tài khoản quản trị — không thao tác được từ đây/)).toBeInTheDocument()
    for (const b of actionButtons()) expect(b.el, b.name).toBeNull()
  })

  it('user thường đang hoạt động -> có Khoá và Thu hồi, KHÔNG có Mở khoá', async () => {
    renderDialog(adminUser({ id: 'u1' }))
    expect(await screen.findByRole('button', { name: 'Khoá' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Thu hồi mọi key' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Mở khoá' })).toBeNull()
  })

  it('đã khoá nhất quán (cờ + ban) -> chỉ Mở khoá, KHÔNG có Khoá', async () => {
    renderDialog(adminUser({ id: 'u1', suspendedAt: PAST_SUSPEND, suspendedReason: 'spam', bannedUntil: FUTURE }))
    expect(await screen.findByRole('button', { name: 'Mở khoá' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khoá' })).toBeNull()
    expect(screen.getByText('Lý do khoá')).toBeInTheDocument()
    expect(screen.getByText('spam')).toBeInTheDocument()
    expect(screen.getByText('Bị khoá')).toBeInTheDocument()
  })

  it('lệch: có cờ DB nhưng GoTrue chưa ban -> hiện CẢ Khoá lẫn Mở khoá để hoàn tất', async () => {
    renderDialog(adminUser({ id: 'u1', suspendedAt: PAST_SUSPEND, bannedUntil: null }))
    expect(await screen.findByRole('button', { name: 'Khoá' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở khoá' })).toBeInTheDocument()
    expect(screen.getByText('Lệch trạng thái')).toBeInTheDocument()
  })

  it('lệch ngược: GoTrue đã ban nhưng cờ DB trống -> hiện CẢ Khoá lẫn Mở khoá', async () => {
    renderDialog(adminUser({ id: 'u1', suspendedAt: null, bannedUntil: FUTURE }))
    expect(await screen.findByRole('button', { name: 'Khoá' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở khoá' })).toBeInTheDocument()
    expect(screen.getByText('Lệch trạng thái')).toBeInTheDocument()
  })
})

describe('AdminUserDialog — nút thu hồi key', () => {
  it('không có key còn hiệu lực -> nút Thu hồi mọi key disabled', async () => {
    renderDialog(adminUser({ id: 'u1', keysActive: 0 }), [adminKey({ id: 'k1', revoked_at: '2026-10-21T00:00:00Z' })])
    expect(await screen.findByRole('button', { name: 'Thu hồi mọi key' })).toBeDisabled()
    expect(screen.getByText('Đã thu hồi')).toBeInTheDocument()
  })

  it('chưa có key nào -> disabled và báo "Chưa có key."', async () => {
    renderDialog(adminUser({ id: 'u1', keysActive: 0 }), [])
    expect(await screen.findByRole('button', { name: 'Thu hồi mọi key' })).toBeDisabled()
    expect(screen.getByText('Chưa có key.')).toBeInTheDocument()
  })

  it('có ít nhất 1 key còn hiệu lực (kèm key đã thu hồi) -> enabled', async () => {
    renderDialog(adminUser({ id: 'u1' }), [
      adminKey({ id: 'k1', revoked_at: '2026-10-21T00:00:00Z' }),
      adminKey({ id: 'k2' }),
    ])
    expect(await screen.findByRole('button', { name: 'Thu hồi mọi key' })).toBeEnabled()
    expect(screen.getByText('API key (1 còn hiệu lực)')).toBeInTheDocument()
  })
})

describe('AdminUserDialog — thông tin vận hành', () => {
  it('hiện số giao dịch đếm và tin chưa ghi được theo reason; không có nội dung giao dịch', async () => {
    renderDialog(adminUser({ id: 'u1', txCount30d: 42, unparsed30d: { no_account: 3, parse_error: 1 }, parseRate30d: 0.93 }))
    await screen.findByRole('button', { name: 'Khoá' })
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('no_account: 3, parse_error: 1')).toBeInTheDocument()
    expect(screen.getByText('93%')).toBeInTheDocument()
  })

  it('không có tin lỗi -> hiện 0', async () => {
    renderDialog(adminUser({ id: 'u1' }))
    await screen.findByRole('button', { name: 'Khoá' })
    const row = screen.getByText('Tin chưa ghi được (30 ngày)').parentElement!
    expect(within(row).getByText('0')).toBeInTheDocument()
  })

  it('chỉ hiện "Lý do khoá" khi đang khoá', async () => {
    renderDialog(adminUser({ id: 'u1' }))
    await screen.findByRole('button', { name: 'Khoá' })
    expect(screen.queryByText('Lý do khoá')).toBeNull()
  })

  it('lỗi tải chi tiết -> hiện thông điệp lỗi', async () => {
    vi.mocked(getAdminUser).mockRejectedValue({ code: 'user_not_found', message: 'Không tìm thấy user (có thể đã bị xoá).' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AdminUserDialog user={adminUser({ id: 'u1' })} onClose={() => {}} />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy user')
  })

  it('gọi get_user đúng userId của dòng được chọn', async () => {
    renderDialog(adminUser({ id: 'u-xyz' }))
    await screen.findByRole('button', { name: 'Khoá' })
    expect(getAdminUser).toHaveBeenCalledWith('u-xyz')
  })
})

describe('AdminUserDialog — mở hộp xác nhận', () => {
  it('bấm Khoá -> mở dialog lý do với tiêu đề có email', async () => {
    renderDialog(adminUser({ id: 'u1', email: 'a@local.dev' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Khoá' }))
    expect(await screen.findByText('Khoá user: a@local.dev')).toBeInTheDocument()
    expect(screen.getByLabelText(/Lý do/)).toBeInTheDocument()
  })

  it('bấm Thu hồi mọi key -> mở dialog thu hồi', async () => {
    renderDialog(adminUser({ id: 'u1', email: 'a@local.dev' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi mọi key' }))
    expect(await screen.findByText('Thu hồi mọi API key: a@local.dev')).toBeInTheDocument()
  })
})
