import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
}))

import { listAdminUsers, listAudit } from '@/services/admin'
import { adminUser, auditEntry } from '@/test/fixtures/admin'
import { AdminAuditList } from './AdminAuditList'

function renderAudit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<AdminAuditList />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev' })])
})

describe('AdminAuditList', () => {
  it('nhãn hành động tiếng Việt; email lấy từ danh sách user đã tải', async () => {
    vi.mocked(listAudit).mockResolvedValue([
      auditEntry({ id: 2, action: 'unsuspend', target_user_id: 'u1', reason: 'đã xác minh' }),
      auditEntry({ id: 1, action: 'suspend', target_user_id: 'u1', reason: 'spam' }),
    ])
    renderAudit()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Mở khoá')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/a@local\.dev/)).toBeInTheDocument()
    expect(within(rows[0]).getByText('đã xác minh')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Khoá')).toBeInTheDocument()
  })

  it('user đã xoá (không còn trong danh sách) -> hiện 8 ký tự đầu của id + (đã xoá)', async () => {
    vi.mocked(listAudit).mockResolvedValue([auditEntry({ id: 1, target_user_id: 'deadbeef-1234-5678' })])
    renderAudit()
    expect(await screen.findByText(/deadbeef… \(đã xoá\)/)).toBeInTheDocument()
  })

  it('target null -> gạch ngang', async () => {
    vi.mocked(listAudit).mockResolvedValue([auditEntry({ id: 1, action: 'suspend', target_user_id: null })])
    renderAudit()
    const row = (await screen.findAllByRole('listitem'))[0]
    expect(within(row).getByText(/—/)).toBeInTheDocument()
  })

  it('thu hồi key hiện số key đã thu hồi từ payload', async () => {
    vi.mocked(listAudit).mockResolvedValue([
      auditEntry({ id: 1, action: 'revoke_keys', reason: 'lộ key', payload: { revoked: 2 } }),
    ])
    renderAudit()
    expect(await screen.findByText(/lộ key \(2 key\)/)).toBeInTheDocument()
    expect(screen.getByText('Thu hồi key')).toBeInTheDocument()
  })

  it('view_user hiện nhãn Xem chi tiết, không kèm số key', async () => {
    vi.mocked(listAudit).mockResolvedValue([
      auditEntry({ id: 1, action: 'view_user', reason: 'kiểm tra', payload: { revoked: 9 } }),
    ])
    renderAudit()
    expect(await screen.findByText('Xem chi tiết')).toBeInTheDocument()
    expect(screen.queryByText(/key\)/)).toBeNull()
  })

  it('nhật ký rỗng -> "Chưa có thao tác nào."', async () => {
    vi.mocked(listAudit).mockResolvedValue([])
    renderAudit()
    expect(await screen.findByText('Chưa có thao tác nào.')).toBeInTheDocument()
  })

  it('lỗi tải -> hiện thông điệp lỗi', async () => {
    vi.mocked(listAudit).mockRejectedValue({ code: 'forbidden', message: 'Tài khoản này không có quyền quản trị.' })
    renderAudit()
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền quản trị')
  })
})
