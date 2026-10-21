import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mount THẬT picker + danh sách + hook + store (chỉ mock tầng service).
vi.mock('@/services/creditCards', () => ({
  getCreditCards: vi.fn(),
  getCreditCardTransactions: vi.fn(),
  updateCardTransactionMcc: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getCreditCards, getCreditCardTransactions, updateCardTransactionMcc } from '@/services/creditCards'
import { TX_PAGE_SIZE } from '@/services/transactionQuery'
import { useFilterStore } from '@/stores/filterStore'
import { MultiCardPicker } from './MultiCardPicker'
import { MultiCardTransactionList } from './MultiCardTransactionList'
import type { CreditCard, CreditCardTransaction } from '@/types/creditCard'

const mkCard = (id: string, bankName: string, cardName: string, last4: string): CreditCard => ({
  id, bankName, cardName, cardNumber: `****${last4}`, cardType: 'visa', currency: 'VND', creditLimit: 0,
  currentBalance: 0, statementDate: 15, paymentDueDate: 5, cashbackMonthlyCap: null, lastUpdated: '2026-01-01T00:00:00Z',
})
const SHB = mkCard('c-shb', 'SHB', 'SHB Visa', '1111')
const VP = mkCard('c-vp', 'VPBank', 'VPBank StepUp', '2222')
const tx = (id: string, cardId: string, merchantName: string, transactionDate: string, amount = -100_000): CreditCardTransaction => ({
  id, cardId, amount, description: merchantName, merchantName, type: 'purchase', status: 'posted', transactionDate,
})

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(<><MultiCardPicker /><MultiCardTransactionList /></>, { wrapper })
}

beforeEach(() => {
  vi.resetAllMocks()
  useFilterStore.getState().resetFilters()
  vi.mocked(getCreditCards).mockResolvedValue({ data: [SHB, VP], nextCursor: null, total: 2 })
  vi.mocked(getCreditCardTransactions).mockResolvedValue({
    data: [
      tx('t1', 'c-vp', 'GRAB', '2026-10-20T03:00:00Z'),
      tx('t2', 'c-shb', 'SHOPEE', '2026-10-20T01:00:00Z', -250_000),
      tx('t3', 'c-shb', 'AEON', '2026-10-18T05:00:00Z'),
    ],
    nextCursor: null,
    total: 3,
  })
})

describe('Mục "Nhiều thẻ"', () => {
  it('mặc định tất cả thẻ: gộp một dòng thời gian nhóm theo ngày, mỗi dòng ghi rõ thẻ', async () => {
    renderView()
    const day = await screen.findByRole('region', { name: /20\/10\/2026|Hôm nay|Hôm qua/ })
    expect(getCreditCardTransactions).toHaveBeenCalledWith({ cardIds: [] }, undefined, TX_PAGE_SIZE, expect.anything())
    const rows = within(day).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('VPBank StepUp · ···· 2222')).toBeInTheDocument()
    expect(within(rows[1]).getByText('SHB Visa · ···· 1111')).toBeInTheDocument()
    expect(screen.getByText('3').closest('p')).toHaveTextContent('3 giao dịch')
    expect(screen.getByRole('button', { name: 'Tất cả thẻ (2)' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('chọn thẻ: truy vấn đúng tập id (sắp xếp, không phụ thuộc thứ tự chọn), bỏ chọn bằng nút ×', async () => {
    renderView()
    await screen.findAllByRole('listitem')
    await userEvent.click(screen.getByRole('combobox', { name: 'Chọn thẻ để xem' }))
    await userEvent.click(await screen.findByRole('option', { name: /VPBank StepUp/ }))
    await userEvent.click(screen.getByRole('option', { name: /SHB Visa/ }))
    // Popover giữ mở để chọn liền nhiều thẻ; cả hai được đánh dấu chọn
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    expect(screen.getByRole('option', { name: /SHB Visa/ })).toHaveAttribute('aria-selected', 'true')

    await waitFor(() => expect(getCreditCardTransactions).toHaveBeenLastCalledWith(
      { cardIds: ['c-shb', 'c-vp'] }, undefined, TX_PAGE_SIZE, expect.anything()))
    expect(useFilterStore.getState().cardIds).toEqual(['c-vp', 'c-shb'])
    expect(screen.getByRole('button', { name: 'Tất cả thẻ (2)' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ VPBank StepUp khỏi danh sách xem' }))
    expect(useFilterStore.getState().cardIds).toEqual(['c-shb'])
    await waitFor(() => expect(getCreditCardTransactions).toHaveBeenLastCalledWith(
      { cardIds: ['c-shb'] }, undefined, TX_PAGE_SIZE, expect.anything()))
  })

  it('thẻ đã bị xoá tự rời khỏi lựa chọn khi danh sách thẻ tải xong', async () => {
    useFilterStore.setState({ cardIds: ['c-gone', 'c-shb'] })
    renderView()
    await waitFor(() => expect(useFilterStore.getState().cardIds).toEqual(['c-shb']))
  })

  it('gán MCC ngay trên dòng của mục nhiều thẻ: cập nhật tức thì (optimistic) và gọi service', async () => {
    let resolveSave!: () => void
    vi.mocked(updateCardTransactionMcc).mockReturnValue(new Promise<void>((r) => { resolveSave = r }))
    renderView()
    const select = await screen.findByRole('combobox', { name: 'Phân loại MCC cho SHOPEE' })
    fireEvent.change(select, { target: { value: '5411' } })
    // Lời gọi lưu còn treo mà ô đã đổi: patch cache dưới khoá ['creditCardTransactions', 'multi', ...]
    await waitFor(() => expect(select).toHaveValue('5411'))
    expect(updateCardTransactionMcc).toHaveBeenCalledWith('t2', '5411')
    resolveSave()
  })
})
