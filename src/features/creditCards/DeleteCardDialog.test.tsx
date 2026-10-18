import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/credit-card-mutations', () => ({
  createCreditCard: vi.fn(),
  updateCreditCard: vi.fn(),
  deleteCreditCard: vi.fn(),
  countCardTransactions: vi.fn(),
}))
vi.mock('@/services/accounts', () => ({ getUnlinkedCount: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))

import { countCardTransactions, deleteCreditCard } from '@/services/credit-card-mutations'
import { useFilterStore } from '@/stores/filterStore'
import { DeleteCardDialog } from './DeleteCardDialog'
import type { CreditCard } from '@/types/creditCard'

const card: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265',
  cardType: 'visa', currency: 'VND', creditLimit: 0, currentBalance: 0,
  statementDate: 9, paymentDueDate: 29, lastUpdated: '2026-01-01T00:00:00Z',
}

function renderDialog(target: CreditCard = card) {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  render(<DeleteCardDialog open onOpenChange={onOpenChange} card={target} />, { wrapper })
  return { onOpenChange }
}

const confirmBtn = () => screen.getByRole('button', { name: /Xoá thẻ và giao dịch|Đang xoá/ })

beforeEach(() => {
  vi.resetAllMocks()
  useFilterStore.setState({ cardId: 'card-1' })
})

describe('DeleteCardDialog', () => {
  it('nói rõ số giao dịch sẽ bị xoá cùng thẻ', async () => {
    vi.mocked(countCardTransactions).mockResolvedValue(12)
    renderDialog()
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText(/xoá vĩnh viễn cùng thẻ/)).toBeInTheDocument()
  })

  it('nút xoá bị khoá cho tới khi gõ đúng tên thẻ', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockResolvedValue(12)
    renderDialog()
    await screen.findByText('12')
    expect(confirmBtn()).toBeDisabled()

    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Vis')
    expect(confirmBtn()).toBeDisabled()

    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'a')
    expect(confirmBtn()).toBeEnabled()
  })

  it('chưa đếm xong giao dịch thì chưa cho xoá dù đã gõ đúng tên', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockReturnValue(new Promise(() => {}))
    renderDialog()
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    expect(screen.getByText('Đang đếm giao dịch…')).toBeInTheDocument()
    expect(confirmBtn()).toBeDisabled()
  })

  it('đếm lỗi thì báo lỗi và không cho xoá', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockRejectedValue({ code: 'X', message: 'lỗi' })
    renderDialog()
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    expect(await screen.findByText(/Không đếm được số giao dịch/)).toBeInTheDocument()
    expect(confirmBtn()).toBeDisabled()
  })

  it('xác nhận: gọi xoá đúng id, bỏ chọn thẻ và đóng dialog', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockResolvedValue(12)
    vi.mocked(deleteCreditCard).mockResolvedValue(12)
    const { onOpenChange } = renderDialog()
    await screen.findByText('12')
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    await u.click(confirmBtn())

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(deleteCreditCard).toHaveBeenCalledWith('card-1')
    expect(useFilterStore.getState().cardId).toBeNull()
  })

  it('xoá lỗi: hiện thông báo, giữ dialog mở và giữ thẻ đang chọn', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockResolvedValue(2)
    vi.mocked(deleteCreditCard).mockRejectedValue({ code: 'P0002', message: 'Không tìm thấy thẻ' })
    const { onOpenChange } = renderDialog()
    await screen.findByText('2')
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    await u.click(confirmBtn())

    expect(await screen.findByText('Không tìm thấy thẻ')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(useFilterStore.getState().cardId).toBe('card-1')
  })

  // Tên lưu trong DB có thể thừa khoảng trắng; user không thể gõ ra khoảng trắng cuối đó.
  it('tên thẻ có khoảng trắng thừa vẫn xác nhận được', async () => {
    const u = userEvent.setup()
    vi.mocked(countCardTransactions).mockResolvedValue(1)
    renderDialog({ ...card, cardName: 'SHB Visa  ' })
    await screen.findByText('1')
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    expect(confirmBtn()).toBeEnabled()
  })

  it('đang xoá thì Esc không đóng dialog (user sẽ không thấy lỗi nếu xoá thất bại)', async () => {
    const u = userEvent.setup()
    let resolveDelete!: (n: number) => void
    vi.mocked(countCardTransactions).mockResolvedValue(3)
    vi.mocked(deleteCreditCard).mockReturnValue(new Promise((r) => { resolveDelete = r }))
    const { onOpenChange } = renderDialog()
    await screen.findByText('3')
    await u.type(screen.getByLabelText(/Gõ lại tên thẻ/), 'SHB Visa')
    await u.click(confirmBtn())
    expect(await screen.findByRole('button', { name: 'Đang xoá…' })).toBeDisabled()

    await u.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()

    resolveDelete(3)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
