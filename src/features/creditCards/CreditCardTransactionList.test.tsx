import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock ở tầng hook dữ liệu; hàng giao dịch được thay bằng stub vì test này chỉ kiểm nhóm theo chu kỳ.
const state = vi.hoisted(() => ({
  txs: [] as unknown[],
  isLoading: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: undefined as unknown as () => void,
}))
vi.mock('@/hooks/useCreditCardTransactions', () => ({
  useCreditCardTransactions: () => ({
    data: { pages: [{ data: state.txs, nextCursor: null, total: state.txs.length }] },
    isLoading: state.isLoading,
    isError: state.isError,
    error: { message: 'mất mạng' },
    fetchNextPage: state.fetchNextPage,
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: false,
  }),
}))
vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: () => ({
    data: { data: [card], nextCursor: null, total: 1 },
    isLoading: false,
  }),
}))
vi.mock('./CreditCardTransactionRow', () => ({
  CreditCardTransactionRow: ({ transaction }: { transaction: { merchantName: string } }) => (
    <div>{transaction.merchantName}</div>
  ),
}))

import { CreditCardTransactionList } from './CreditCardTransactionList'
import { useFilterStore } from '@/stores/filterStore'

// Thẻ sao kê ngày 9: chu kỳ kết thúc 00:00 VN ngày 10 = 17:00 UTC ngày 9
const card = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265', cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  lastUpdated: '2026-01-01T00:00:00Z',
}
const tx = (name: string) => ({
  id: name, cardId: 'card-1', amount: -1000, description: name, merchantName: name,
  type: 'purchase', status: 'posted', transactionDate: '2026-04-01T00:00:00Z',
})

function renderList() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(<CreditCardTransactionList />, { wrapper })
}

beforeEach(() => {
  state.txs = [tx('Grab')]
  state.isLoading = false
  state.isError = false
  state.hasNextPage = false
  state.fetchNextPage = vi.fn()
  useFilterStore.setState({ cardId: 'card-1', searchQuery: '', dateFrom: null, dateTo: null, txType: 'all' })
})
afterEach(() => { vi.useRealTimers() })

describe('CreditCardTransactionList', () => {
  it('nhóm giao dịch dưới chu kỳ hiện tại với khoảng ngày đúng', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T05:00:00Z'))
    renderList()
    expect(screen.getByText('Chu kỳ hiện tại')).toBeInTheDocument()
    expect(screen.getByText('10/03/2026 – 09/04/2026')).toBeInTheDocument()
    expect(screen.getByText('Grab')).toBeInTheDocument()
  })

  // Trước đây `now` chốt một lần lúc mount: tab mở qua mốc cắt vẫn hiện chu kỳ cũ, trong khi
  // BillingCycleInfoCard (cùng trang) đã sang chu kỳ mới -> hai khối hiện hai chu kỳ khác nhau.
  it('tab mở qua mốc cắt sao kê: kỳ cũ thôi là "hiện tại", giao dịch vẫn ở đúng kỳ của nó', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-09T16:30:00Z'))
    renderList()
    expect(screen.getByText('Chu kỳ hiện tại')).toBeInTheDocument()
    expect(screen.getByText('10/03/2026 – 09/04/2026')).toBeInTheDocument()

    await act(async () => {
      vi.setSystemTime(new Date('2026-04-09T17:05:00Z'))
      await vi.advanceTimersByTimeAsync(60_000)
    })
    // Giao dịch 01/04 thuộc kỳ 10/03–09/04 dù đồng hồ đã sang kỳ mới — không bị kéo sang kỳ 10/04–09/05
    expect(screen.getByText('10/03/2026 – 09/04/2026')).toBeInTheDocument()
    expect(screen.queryByText('10/04/2026 – 09/05/2026')).not.toBeInTheDocument()
    expect(screen.getByText('Chu kỳ trước')).toBeInTheDocument()
    expect(screen.queryByText('Chu kỳ hiện tại')).not.toBeInTheDocument()
  })

  it('giữa chu kỳ: đồng hồ chạy mà khoảng ngày không đổi', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T05:00:00Z'))
    renderList()
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000) })
    expect(screen.getByText('10/03/2026 – 09/04/2026')).toBeInTheDocument()
  })

  it('không có giao dịch: báo rỗng, khác với khi đang lọc', () => {
    state.txs = []
    const { unmount } = renderList()
    expect(screen.getByText('Chưa có giao dịch thẻ')).toBeInTheDocument()
    unmount()

    useFilterStore.setState({ searchQuery: 'grab' })
    renderList()
    expect(screen.getByText('Không có giao dịch phù hợp')).toBeInTheDocument()
  })

  it('lỗi tải: hiện thông báo lỗi thay vì danh sách rỗng', () => {
    state.isError = true
    renderList()
    expect(screen.getByText('Không thể tải giao dịch thẻ')).toBeInTheDocument()
    expect(screen.getByText('mất mạng')).toBeInTheDocument()
  })

  it('còn trang sau: nút "Xem thêm" tải trang kế', async () => {
    const u = userEvent.setup()
    state.hasNextPage = true
    renderList()
    await u.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(state.fetchNextPage).toHaveBeenCalledTimes(1)
  })
})
