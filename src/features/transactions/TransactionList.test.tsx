import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useFilterStore } from '@/stores/filterStore'
import { TransactionList } from './TransactionList'
import * as accountsService from '@/services/accounts'
import type { Transaction } from '@/types/account'

// Mock ở tầng service: component test kiểm tra render logic, không cần DB thật.
// (Query thật đã được phủ bởi services.integration.test.ts)
vi.mock('@/services/accounts')

const ACCOUNT_ID = 'acc-1'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    accountId: ACCOUNT_ID,
    amount: -150000,
    description: 'Highlands Coffee',
    merchantName: 'Highlands Coffee',
    category: 'Ăn uống',
    type: 'expense',
    status: 'posted',
    transactionDate: '2026-09-02T01:15:00.000Z',
    ...over,
  }
}

function mockPage(data: Transaction[], nextCursor: string | null = null) {
  vi.mocked(accountsService.getTransactions).mockResolvedValue({
    data,
    nextCursor,
    total: data.length,
  })
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  useFilterStore.setState({
    accountId: ACCOUNT_ID,
    cardId: null,
    dateFrom: null,
    dateTo: null,
    searchQuery: '',
    txType: 'all',
    category: 'all',
  })
})

afterEach(() => vi.clearAllMocks())

describe('TransactionList', () => {
  it('hiện skeleton khi đang tải', () => {
    vi.mocked(accountsService.getTransactions).mockReturnValue(new Promise(() => {}))
    const { container } = render(createElement(TransactionList), { wrapper: createWrapper() })
    // Skeleton không có testid — nhận diện qua số khối skeleton được render
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByText('Chưa có giao dịch')).not.toBeInTheDocument()
  })

  it('render giao dịch sau khi tải xong', async () => {
    mockPage([tx(), tx({ id: 'tx-2', description: 'SHOPEE', merchantName: 'SHOPEE' })])
    render(createElement(TransactionList), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Highlands Coffee')).toBeInTheDocument()
    })
    expect(screen.getByText('SHOPEE')).toBeInTheDocument()
  })

  it('hiện empty state khi không có giao dịch', async () => {
    mockPage([])
    render(createElement(TransactionList), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Chưa có giao dịch')).toBeInTheDocument()
    })
  })

  it('hiện lỗi khi service throw', async () => {
    vi.mocked(accountsService.getTransactions).mockRejectedValue({
      code: '500',
      message: 'Lỗi máy chủ',
    })
    render(createElement(TransactionList), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Không thể tải giao dịch')).toBeInTheDocument()
    })
  })

  it('truyền filter từ store xuống service', async () => {
    mockPage([tx()])
    useFilterStore.setState({ searchQuery: 'Highlands', txType: 'expense' })
    render(createElement(TransactionList), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(accountsService.getTransactions).toHaveBeenCalledWith(
        ACCOUNT_ID,
        undefined,
        20,
        expect.objectContaining({ search: 'Highlands', txType: 'expense' })
      )
    })
  })

  it('hiện nút tải thêm khi còn trang sau', async () => {
    mockPage([tx()], 'cursor-abc')
    render(createElement(TransactionList), { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument()
    })
  })

  it('bấm tải thêm sẽ gọi service với cursor', async () => {
    const user = userEvent.setup()
    // Mock theo cursor (không theo thứ tự gọi): React Query có thể refetch trang đầu,
    // mockResolvedValueOnce sẽ trả sai trang khi đó.
    vi.mocked(accountsService.getTransactions).mockImplementation(async (_id, cursor) =>
      cursor === 'cursor-abc'
        ? { data: [tx({ id: 'tx-2', description: 'SHOPEE', merchantName: 'SHOPEE' })], nextCursor: null, total: 2 }
        : { data: [tx()], nextCursor: 'cursor-abc', total: 2 }
    )

    render(createElement(TransactionList), { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByText('Highlands Coffee')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /xem thêm/i }))
    await waitFor(() => expect(screen.getByText('SHOPEE')).toBeInTheDocument())

    expect(accountsService.getTransactions).toHaveBeenLastCalledWith(
      ACCOUNT_ID, 'cursor-abc', 20, expect.anything()
    )
  })
})
