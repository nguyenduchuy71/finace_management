import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  listAudit: vi.fn(),
  runAdminMutation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { runAdminMutation } from '@/services/admin'
import { toast } from 'sonner'
import { adminUser } from '@/test/fixtures/admin'
import type { AdminMutation } from '@/types/admin'
import { AdminActionDialog } from './AdminActionDialog'

const target = adminUser({ id: 'u1', email: 'nguoi.dung@local.dev' })

function renderDialog(action: AdminMutation | null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<AdminActionDialog action={action} user={target} onClose={onClose} />, { wrapper })
  return { onClose }
}

const reasonBox = () => screen.getByLabelText(/Lý do/)
const confirmBtn = (name: string) => screen.getByRole('button', { name })
const typeReason = (v: string) => fireEvent.change(reasonBox(), { target: { value: v } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runAdminMutation).mockResolvedValue(undefined)
})

describe('AdminActionDialog — ràng buộc lý do', () => {
  it('lý do rỗng -> nút xác nhận disabled', () => {
    renderDialog('suspend')
    expect(confirmBtn('Khoá')).toBeDisabled()
  })

  it('4 ký tự -> disabled; 5 ký tự -> enabled (ngưỡng đúng ở biên)', () => {
    renderDialog('suspend')
    typeReason('abcd')
    expect(confirmBtn('Khoá')).toBeDisabled()
    typeReason('abcde')
    expect(confirmBtn('Khoá')).toBeEnabled()
  })

  it('chỉ toàn khoảng trắng hoặc đệm khoảng trắng làm đủ độ dài -> vẫn disabled (đếm sau trim)', () => {
    renderDialog('suspend')
    typeReason('          ')
    expect(confirmBtn('Khoá')).toBeDisabled()
    typeReason('abc    ')
    expect(confirmBtn('Khoá')).toBeDisabled()
  })

  it('textarea có maxLength 500 và hiện gợi ý 5–500 ký tự', () => {
    renderDialog('suspend')
    expect(reasonBox()).toHaveAttribute('maxLength', '500')
    expect(screen.getByText(/5–500 ký tự/)).toBeInTheDocument()
  })

  it('501 ký tự (sau trim) -> disabled; đúng 500 -> enabled', () => {
    renderDialog('suspend')
    typeReason('a'.repeat(501))
    expect(confirmBtn('Khoá')).toBeDisabled()
    typeReason('a'.repeat(500))
    expect(confirmBtn('Khoá')).toBeEnabled()
  })

  it('không gọi mutation khi lý do chưa hợp lệ (kể cả bấm trực tiếp)', async () => {
    renderDialog('suspend')
    typeReason('abc')
    fireEvent.click(confirmBtn('Khoá'))
    expect(runAdminMutation).not.toHaveBeenCalled()
  })
})

describe('AdminActionDialog — gửi', () => {
  it('gửi lý do ĐÃ TRIM, đúng action và userId', async () => {
    const { onClose } = renderDialog('suspend')
    typeReason('   vi phạm điều khoản   ')
    fireEvent.click(confirmBtn('Khoá'))
    await waitFor(() => expect(runAdminMutation).toHaveBeenCalledWith('suspend', 'u1', 'vi phạm điều khoản'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Đã khoá user')
  })

  it('thành công với mở khoá -> toast đúng nhãn', async () => {
    const { onClose } = renderDialog('unsuspend')
    typeReason('đã xác minh lại')
    fireEvent.click(confirmBtn('Mở khoá'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Đã mở khoá user')
  })

  it('ban_failed khi MỞ khoá -> thông điệp đúng chiều (user vẫn chưa đăng nhập được)', async () => {
    vi.mocked(runAdminMutation).mockRejectedValue({ code: 'ban_failed', message: 'thông điệp chung' })
    renderDialog('unsuspend')
    typeReason('đã xác minh lại')
    fireEvent.click(confirmBtn('Mở khoá'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('VẪN chưa đăng nhập được')
    expect(alert).not.toHaveTextContent('CHƯA chặn được đăng nhập')
  })

  it('ban_failed -> hiện thông điệp lỗi trong dialog, KHÔNG đóng, nút vẫn dùng được để bấm lại', async () => {
    vi.mocked(runAdminMutation).mockRejectedValue({ code: 'ban_failed', message: 'thông điệp chung' })
    const { onClose } = renderDialog('suspend')
    typeReason('lý do đủ dài')
    fireEvent.click(confirmBtn('Khoá'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('CHƯA chặn được đăng nhập')
    expect(onClose).not.toHaveBeenCalled()
    expect(confirmBtn('Khoá')).toBeEnabled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('lỗi không có message -> thông điệp dự phòng', async () => {
    vi.mocked(runAdminMutation).mockRejectedValue({ code: 'x' })
    renderDialog('revoke_keys')
    typeReason('lý do đủ dài')
    fireEvent.click(confirmBtn('Thu hồi'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thực hiện được. Vui lòng thử lại.')
  })

  it('Huỷ -> gọi onClose, không gọi mutation', () => {
    const { onClose } = renderDialog('suspend')
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(onClose).toHaveBeenCalled()
    expect(runAdminMutation).not.toHaveBeenCalled()
  })
})

describe('AdminActionDialog — nội dung theo hành động', () => {
  it('thu hồi key: tiêu đề và nút đúng, nêu rõ thao tác là vĩnh viễn', () => {
    renderDialog('revoke_keys')
    expect(screen.getByText('Thu hồi mọi API key: nguoi.dung@local.dev')).toBeInTheDocument()
    expect(screen.getByText(/Thu hồi là vĩnh viễn/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thu hồi' })).toBeInTheDocument()
  })

  it('action null -> dialog đóng, không render gì', () => {
    renderDialog(null)
    expect(screen.queryByLabelText(/Lý do/)).toBeNull()
  })

  it('đổi action (đóng rồi mở lại) -> lý do được reset', () => {
    const client = new QueryClient()
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <AdminActionDialog action="suspend" user={target} onClose={() => {}} />
      </QueryClientProvider>,
    )
    typeReason('lý do cũ đã nhập')
    rerender(
      <QueryClientProvider client={client}>
        <AdminActionDialog action="unsuspend" user={target} onClose={() => {}} />
      </QueryClientProvider>,
    )
    expect(reasonBox()).toHaveValue('')
  })
})
