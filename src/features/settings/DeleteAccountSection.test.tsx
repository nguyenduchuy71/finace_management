import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/account-deletion', () => ({ deleteMyAccount: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { deleteMyAccount } from '@/services/account-deletion'
import { AuthContext } from '@/features/auth/AuthProvider'
import { DeleteAccountSection } from './DeleteAccountSection'

const EMAIL = 'Nguyen.Duc.Huy@Example.com'

function renderWithEmail(email: string | null) {
  const session = email ? ({ user: { email } } as unknown as Session) : null
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ session, loading: false }}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
  render(<DeleteAccountSection />, { wrapper })
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Xoá tài khoản' }))
  const dialog = await screen.findByRole('dialog')
  return {
    dialog,
    input: within(dialog).getByLabelText(/Gõ lại email/) as HTMLInputElement,
    confirm: within(dialog).getByRole('button', { name: 'Xoá tài khoản' }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(deleteMyAccount).mockReset()
  vi.mocked(deleteMyAccount).mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('DeleteAccountSection', () => {
  it('chưa có session/email -> nút mở xoá bị disabled', () => {
    renderWithEmail(null)
    expect(screen.getByRole('button', { name: 'Xoá tài khoản' })).toBeDisabled()
  })

  it('mở dialog: nút xác nhận disabled khi chưa gõ gì', async () => {
    renderWithEmail(EMAIL)
    const { confirm, input } = await openDialog()
    expect(input).toHaveValue('')
    expect(confirm).toBeDisabled()
  })

  it('chỉ bật khi gõ đúng email; không phân biệt hoa thường (và bỏ khoảng trắng đầu/cuối)', async () => {
    renderWithEmail(EMAIL)
    const { input, confirm } = await openDialog()

    fireEvent.change(input, { target: { value: 'nguyen.duc.huy@example.co' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'nguyen.duc.huy@example.com.vn' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'NGUYEN.DUC.HUY@EXAMPLE.COM' } })
    expect(confirm).toBeEnabled()

    fireEvent.change(input, { target: { value: '  nguyen.duc.huy@example.com  ' } })
    expect(confirm).toBeEnabled()
  })

  it('gõ đúng email -> gọi deleteMyAccount đúng 1 lần', async () => {
    renderWithEmail(EMAIL)
    const { input, confirm } = await openDialog()
    fireEvent.change(input, { target: { value: EMAIL.toLowerCase() } })
    fireEvent.click(confirm)
    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledTimes(1))
  })

  it('xoá lỗi -> hiện message trong dialog, dialog vẫn mở và nút xác nhận bật lại', async () => {
    vi.mocked(deleteMyAccount).mockRejectedValue({
      code: 'DELETE_ACCOUNT_FAILED',
      message: 'Không xoá được tài khoản. Kiểm tra mạng rồi thử lại.',
    })
    renderWithEmail(EMAIL)
    const { dialog, input, confirm } = await openDialog()
    fireEvent.change(input, { target: { value: EMAIL } })
    fireEvent.click(confirm)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Kiểm tra mạng rồi thử lại.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Xoá tài khoản' })).toBeEnabled()
  })

  it('Huỷ -> đóng dialog và KHÔNG gọi deleteMyAccount', async () => {
    renderWithEmail(EMAIL)
    const { dialog, input } = await openDialog()
    fireEvent.change(input, { target: { value: EMAIL } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deleteMyAccount).not.toHaveBeenCalled()
  })
})
