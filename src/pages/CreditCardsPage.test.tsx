import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'

// Mock ở tầng hook/service như các test khác; các thành phần con nặng được thay bằng
// stub vì test này chỉ kiểm phần quản lý thẻ (thêm/sửa/xoá) của trang.
const state = vi.hoisted(() => ({
  cards: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn(),
}))
vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: () => ({
    data: state.isLoading || state.isError
      ? undefined
      : { data: state.cards, nextCursor: null, total: state.cards.length },
    isLoading: state.isLoading,
    isError: state.isError,
    refetch: state.refetch,
  }),
}))
vi.mock('@/features/creditCards/CreditCardSelector', () => ({ CreditCardSelector: () => <div>selector</div> }))
vi.mock('@/features/creditCards/CreditCardTransactionList', () => ({ CreditCardTransactionList: () => <div>tx-list</div> }))
vi.mock('@/features/creditCards/BillingCycleInfoCard', () => ({ BillingCycleInfoCard: () => <div>cycle-info</div> }))
vi.mock('@/components/filters/FilterBar', () => ({
  FilterBar: ({ showExport = true }: { showExport?: boolean }) => <div>filter-bar{showExport ? '' : ' (không xuất)'}</div>,
}))
vi.mock('@/features/creditCards/MultiCardPicker', () => ({ MultiCardPicker: () => <div>multi-picker</div> }))
vi.mock('@/features/creditCards/MultiCardTransactionList', () => ({ MultiCardTransactionList: () => <div>multi-list</div> }))
vi.mock('@/services/credit-card-mutations', () => ({
  createCreditCard: vi.fn(), updateCreditCard: vi.fn(), deleteCreditCard: vi.fn(),
  countCardTransactions: vi.fn().mockResolvedValue(7),
}))
vi.mock('@/services/accounts', () => ({ getUnlinkedCount: vi.fn().mockResolvedValue(0) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))

import { CreditCardsPage } from './CreditCardsPage'
import { useFilterStore } from '@/stores/filterStore'

const card = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265',
  cardType: 'visa', currency: 'VND', creditLimit: 0, currentBalance: 0,
  statementDate: 9, paymentDueDate: 29, lastUpdated: '2026-01-01T00:00:00Z',
}

function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>
}

function renderPage(path = '/credit-cards') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [path] }, children, React.createElement(LocationProbe)))
  return render(<CreditCardsPage />, { wrapper })
}

beforeEach(() => {
  state.cards = []
  state.isLoading = false
  state.isError = false
  state.refetch = vi.fn()
  useFilterStore.setState({ cardId: null })
})

describe('CreditCardsPage — quản lý thẻ', () => {
  it('chưa có thẻ: hiện trạng thái rỗng, không có selector/danh sách/nút sửa xoá', () => {
    renderPage()
    expect(screen.getByText('Chưa có thẻ tín dụng nào')).toBeInTheDocument()
    expect(screen.queryByText('selector')).not.toBeInTheDocument()
    expect(screen.queryByText('tx-list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sửa thẻ đang chọn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xoá thẻ đang chọn' })).not.toBeInTheDocument()
  })

  it('đang tải: không nháy trạng thái rỗng', () => {
    state.isLoading = true
    renderPage()
    expect(screen.queryByText('Chưa có thẻ tín dụng nào')).not.toBeInTheDocument()
  })

  it('từ trạng thái rỗng mở được form thêm thẻ', async () => {
    const u = userEvent.setup()
    renderPage()
    await u.click(screen.getByRole('button', { name: /Thêm thẻ đầu tiên/ }))
    expect(await screen.findByText('Thêm thẻ tín dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên thẻ')).toHaveValue('')
  })

  it('có thẻ đang chọn: hiện đủ selector, danh sách và nút sửa/xoá', () => {
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
    renderPage()
    expect(screen.getByText('selector')).toBeInTheDocument()
    expect(screen.getByText('tx-list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sửa thẻ đang chọn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xoá thẻ đang chọn' })).toBeInTheDocument()
  })

  it('nút Sửa mở form điền sẵn thẻ đang chọn', async () => {
    const u = userEvent.setup()
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
    renderPage()
    await u.click(screen.getByRole('button', { name: 'Sửa thẻ đang chọn' }))
    expect(await screen.findByText('Sửa thẻ tín dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên thẻ')).toHaveValue('SHB Visa')
  })

  it('Thêm thẻ khi đang chọn một thẻ vẫn mở form TRỐNG (không dính dữ liệu thẻ đang chọn)', async () => {
    const u = userEvent.setup()
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
    renderPage()
    await u.click(screen.getByRole('button', { name: /^Thêm thẻ$/ }))
    expect(await screen.findByText('Thêm thẻ tín dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên thẻ')).toHaveValue('')
  })

  it('nút Xoá mở dialog xác nhận kèm số giao dịch của thẻ', async () => {
    const u = userEvent.setup()
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
    renderPage()
    await u.click(screen.getByRole('button', { name: 'Xoá thẻ đang chọn' }))
    expect(await screen.findByText(/Xoá thẻ “SHB Visa”\?/)).toBeInTheDocument()
    expect(await screen.findByText('7')).toBeInTheDocument()
  })

  // Lỗi tải không được trình bày như "chưa có thẻ": user sẽ bị mời thêm lại thẻ đã có.
  it('tải thẻ lỗi: báo lỗi + nút thử lại, KHÔNG hiện "chưa có thẻ"', async () => {
    const u = userEvent.setup()
    state.isError = true
    renderPage()
    expect(screen.getByText('Không tải được danh sách thẻ')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có thẻ tín dụng nào')).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(state.refetch).toHaveBeenCalledTimes(1)
  })

  it('thẻ biến mất khi đang sửa: dialog đóng, không chuyển sang chế độ thêm mới', async () => {
    const u = userEvent.setup()
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
    const view = renderPage()
    await u.click(screen.getByRole('button', { name: 'Sửa thẻ đang chọn' }))
    expect(await screen.findByText('Sửa thẻ tín dụng')).toBeInTheDocument()

    state.cards = [{ ...card, id: 'card-2', cardName: 'Thẻ khác' }]
    view.rerender(<CreditCardsPage />)
    expect(screen.queryByText('Sửa thẻ tín dụng')).not.toBeInTheDocument()
    expect(screen.queryByText('Thêm thẻ tín dụng')).not.toBeInTheDocument()
  })

  it('thẻ biến mất khi đang mở dialog xoá: không bật lại cho thẻ được chọn sau đó', async () => {
    const u = userEvent.setup()
    const other = { ...card, id: 'card-2', cardName: 'Thẻ khác' }
    state.cards = [card, other]
    useFilterStore.setState({ cardId: 'card-1' })
    const view = renderPage()
    await u.click(screen.getByRole('button', { name: 'Xoá thẻ đang chọn' }))
    expect(await screen.findByText(/Xoá thẻ “SHB Visa”\?/)).toBeInTheDocument()

    state.cards = [other]
    view.rerender(<CreditCardsPage />)
    expect(screen.queryByText(/Xoá thẻ “/)).not.toBeInTheDocument()

    act(() => useFilterStore.setState({ cardId: 'card-2' }))
    view.rerender(<CreditCardsPage />)
    expect(screen.queryByText(/Xoá thẻ “/)).not.toBeInTheDocument()
  })
})

describe('CreditCardsPage — mục Từng thẻ / Nhiều thẻ', () => {
  beforeEach(() => {
    state.cards = [card]
    useFilterStore.setState({ cardId: 'card-1' })
  })

  it('mặc định "Từng thẻ": selector, chu kỳ, danh sách một thẻ, có Sửa/Xoá', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Từng thẻ' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('selector')).toBeInTheDocument()
    expect(screen.getByText('tx-list')).toBeInTheDocument()
    expect(screen.queryByText('multi-list')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sửa thẻ đang chọn' })).toBeInTheDocument()
  })

  it('chuyển "Nhiều thẻ": ghi ?view=all, hiện danh sách gộp, ẩn Sửa/Xoá và nút xuất', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Nhiều thẻ' }))
    expect(screen.getByTestId('search')).toHaveTextContent('?view=all')
    expect(screen.getByText('multi-picker')).toBeInTheDocument()
    expect(screen.getByText('multi-list')).toBeInTheDocument()
    expect(screen.getByText('filter-bar (không xuất)')).toBeInTheDocument()
    expect(screen.queryByText('tx-list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sửa thẻ đang chọn' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thêm thẻ/ })).toBeInTheDocument()
  })

  it('mở thẳng URL ?view=all vào mục Nhiều thẻ', () => {
    renderPage('/credit-cards?view=all')
    expect(screen.getByRole('tab', { name: 'Nhiều thẻ' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('multi-list')).toBeInTheDocument()
  })
})
