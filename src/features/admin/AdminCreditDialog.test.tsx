import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(), getAdminUser: vi.fn(), listAudit: vi.fn(), runAdminMutation: vi.fn(),
  adjustAdminCredit: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { adjustAdminCredit } from '@/services/admin'
import { adminUser } from '@/test/fixtures/admin'
import { parseCreditDelta } from '@/types/admin'
import { AdminCreditDialog } from './AdminCreditDialog'

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AdminCreditDialog open user={adminUser({ id: 'u1', email: 'an@x.vn', creditBalance: 12 })} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}
const fill = (delta: string, reason: string) => {
  fireEvent.change(screen.getByLabelText('Số credit (+/−)'), { target: { value: delta } })
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: reason } })
}
const submit = () => screen.getByRole('button', { name: 'Điều chỉnh' })

beforeEach(() => vi.clearAllMocks())

describe('parseCreditDelta', () => {
  it('nhận số nguyên có/không dấu, từ chối rỗng / 0 / số thực / chữ / quá trần', () => {
    expect([parseCreditDelta('50'), parseCreditDelta('+50'), parseCreditDelta(' -5 ')]).toEqual([50, 50, -5])
    expect([parseCreditDelta(''), parseCreditDelta('0'), parseCreditDelta('+0'), parseCreditDelta('1.5'),
      parseCreditDelta('1,5'), parseCreditDelta('abc'), parseCreditDelta('1000001'), parseCreditDelta('-1000001'),
      parseCreditDelta('12345678')]).toEqual([null, null, null, null, null, null, null, null, null])
    expect(parseCreditDelta('1000000')).toBe(1_000_000)
  })
})

describe('AdminCreditDialog', () => {
  it('nút chỉ bật khi delta hợp lệ VÀ lý do 5..500 ký tự', () => {
    renderDialog()
    expect(submit()).toBeDisabled()
    fill('10', 'abcd')
    expect(submit()).toBeDisabled()
    fill('0', 'tang credit beta')
    expect(submit()).toBeDisabled()
    fill('10', 'tang credit beta')
    expect(submit()).toBeEnabled()
  })

  it('gửi delta đã parse + lý do đã trim, thành công thì đóng', async () => {
    vi.mocked(adjustAdminCredit).mockResolvedValue(22)
    const onClose = renderDialog()
    fill('+10', '  tang credit beta  ')
    fireEvent.click(submit())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(adjustAdminCredit).toHaveBeenCalledWith('u1', 10, 'tang credit beta')
  })

  it('trừ quá số dư -> hiện lỗi từ server, KHÔNG đóng', async () => {
    vi.mocked(adjustAdminCredit).mockRejectedValue({ code: 'insufficient_credit', message: 'Số dư không đủ để trừ.' })
    const onClose = renderDialog()
    fill('-99', 'tru qua tay')
    fireEvent.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Số dư không đủ để trừ.')
    expect(onClose).not.toHaveBeenCalled()
  })
})
