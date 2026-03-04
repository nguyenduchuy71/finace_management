import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { server } from '@/mocks/server'
import { useTransactions } from './useTransactions'
import { useFilterStore } from '@/stores/filterStore'
import { http, HttpResponse } from 'msw'

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  // Reset filter store to default state after each test
  useFilterStore.setState({
    accountId: 'vcb-checking-001',
    cardId: null,
    dateFrom: null,
    dateTo: null,
    searchQuery: '',
    txType: 'all',
  })
})
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useTransactions', () => {
  it('fetches transactions when accountId is set', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const allTransactions = result.current.data?.pages.flatMap((p) => p.data) ?? []
    expect(Array.isArray(allTransactions)).toBe(true)
    expect(allTransactions.length).toBeGreaterThan(0)
  })

  it('returns empty data when accountId is null (disabled)', async () => {
    useFilterStore.setState({ accountId: null })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    // With enabled: false, hook never fetches — stays in initial loading state
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('transactions have the expected data structure', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const transactions = result.current.data?.pages.flatMap((p) => p.data) ?? []
    expect(transactions.length).toBeGreaterThan(0)

    const firstTx = transactions[0]
    expect(firstTx).toHaveProperty('id')
    expect(firstTx).toHaveProperty('accountId', 'vcb-checking-001')
    expect(firstTx).toHaveProperty('amount')
    expect(firstTx).toHaveProperty('description')
    expect(firstTx).toHaveProperty('type')
    expect(['income', 'expense']).toContain(firstTx.type)
    expect(firstTx).toHaveProperty('status')
    expect(['pending', 'posted']).toContain(firstTx.status)
    expect(firstTx).toHaveProperty('transactionDate')
  })

  it('filters by txType=income', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001', txType: 'income' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const transactions = result.current.data?.pages.flatMap((p) => p.data) ?? []
    // All returned transactions should be income type
    transactions.forEach((tx) => {
      expect(tx.type).toBe('income')
    })
  })

  it('filters by txType=expense', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001', txType: 'expense' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const transactions = result.current.data?.pages.flatMap((p) => p.data) ?? []
    transactions.forEach((tx) => {
      expect(tx.type).toBe('expense')
    })
  })

  it('filters by date range', async () => {
    useFilterStore.setState({
      accountId: 'vcb-checking-001',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const transactions = result.current.data?.pages.flatMap((p) => p.data) ?? []
    transactions.forEach((tx) => {
      const txDate = tx.transactionDate.substring(0, 10)
      expect(txDate >= '2026-01-01').toBe(true)
      expect(txDate <= '2026-01-31').toBe(true)
    })
  })

  it('returns paginated data with nextCursor field', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const firstPage = result.current.data?.pages[0]
    expect(firstPage).toHaveProperty('data')
    expect(firstPage).toHaveProperty('total')
    // nextCursor can be null (if all data fits) or a string
    expect(['string', 'object']).toContain(typeof firstPage?.nextCursor)
  })

  it('handles API error state', async () => {
    server.use(
      http.get('/api/accounts/:accountId/transactions', () => {
        return HttpResponse.error()
      })
    )
    useFilterStore.setState({ accountId: 'vcb-checking-001' })
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns different transactions for different accountIds', async () => {
    useFilterStore.setState({ accountId: 'vcb-checking-001' })
    const { result: resultVCB } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(resultVCB.current.isSuccess).toBe(true))

    const vcbTxs = resultVCB.current.data?.pages.flatMap((p) => p.data) ?? []
    vcbTxs.forEach((tx) => {
      expect(tx.accountId).toBe('vcb-checking-001')
    })

    useFilterStore.setState({ accountId: 'tcb-saving-001' })
    const { result: resultTCB } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(resultTCB.current.isSuccess).toBe(true))

    const tcbTxs = resultTCB.current.data?.pages.flatMap((p) => p.data) ?? []
    tcbTxs.forEach((tx) => {
      expect(tx.accountId).toBe('tcb-saving-001')
    })
  })
})
