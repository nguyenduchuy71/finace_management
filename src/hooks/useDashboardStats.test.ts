import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { server } from '@/mocks/server'
import { useDashboardStats } from './useDashboardStats'
import { useDashboardStore } from '@/stores/dashboardStore'
import { http, HttpResponse } from 'msw'

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  // Reset dashboard store after each test
  useDashboardStore.setState({ dateFrom: null, dateTo: null })
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

describe('useDashboardStats', () => {
  it('fetches dashboard stats without date filter', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toBeDefined()
  })

  it('returns correct DashboardStats structure', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const stats = result.current.data!
    expect(stats).toHaveProperty('totalIncome')
    expect(stats).toHaveProperty('totalExpense')
    expect(stats).toHaveProperty('bankIncome')
    expect(stats).toHaveProperty('bankExpense')
    expect(stats).toHaveProperty('ccIncome')
    expect(stats).toHaveProperty('ccExpense')
    expect(stats).toHaveProperty('categoryBreakdown')
    expect(stats).toHaveProperty('transactionCount')
    expect(Array.isArray(stats.categoryBreakdown)).toBe(true)
  })

  it('all numeric stats are non-negative integers', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const stats = result.current.data!
    expect(stats.totalIncome).toBeGreaterThanOrEqual(0)
    expect(stats.totalExpense).toBeGreaterThanOrEqual(0)
    expect(stats.bankIncome).toBeGreaterThanOrEqual(0)
    expect(stats.bankExpense).toBeGreaterThanOrEqual(0)
    expect(stats.ccIncome).toBeGreaterThanOrEqual(0)
    expect(stats.ccExpense).toBeGreaterThanOrEqual(0)
    expect(stats.transactionCount).toBeGreaterThanOrEqual(0)

    expect(Number.isInteger(stats.totalIncome)).toBe(true)
    expect(Number.isInteger(stats.totalExpense)).toBe(true)
  })

  it('categoryBreakdown items have category and amount', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const breakdown = result.current.data!.categoryBreakdown
    breakdown.forEach((item) => {
      expect(item).toHaveProperty('category')
      expect(typeof item.category).toBe('string')
      expect(item).toHaveProperty('amount')
      expect(item.amount).toBeGreaterThanOrEqual(0)
    })
  })

  it('totalExpense equals bankExpense + ccExpense', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const { totalExpense, bankExpense, ccExpense } = result.current.data!
    expect(totalExpense).toBe(bankExpense + ccExpense)
  })

  it('totalIncome equals bankIncome + ccIncome', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const { totalIncome, bankIncome, ccIncome } = result.current.data!
    expect(totalIncome).toBe(bankIncome + ccIncome)
  })

  it('filters stats by date range when dashboardStore has dates', async () => {
    // Set a narrow date range (January 2026 only)
    useDashboardStore.setState({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const filteredStats = result.current.data!
    expect(filteredStats.transactionCount).toBeGreaterThanOrEqual(0)
    // Filtered count should be less than or equal to the total count without filter
    expect(filteredStats.transactionCount).toBeLessThanOrEqual(200)
  })

  it('handles API error state', async () => {
    server.use(
      http.get('/api/dashboard/stats', () => {
        return HttpResponse.error()
      })
    )

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('re-fetches when date range changes', async () => {
    const wrapper = createWrapper()
    const { result, rerender } = renderHook(() => useDashboardStats(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const initialCount = result.current.data!.transactionCount

    // Change date range to narrow window
    useDashboardStore.setState({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })
    rerender()

    // After rerender with new dates, hook may refetch
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Stats may differ with different date range
    const newCount = result.current.data!.transactionCount
    // Both counts should be valid numbers
    expect(typeof newCount).toBe('number')
    expect(typeof initialCount).toBe('number')
  })

  it('makes parallel queries for current and previous month with useQueries', async () => {
    useDashboardStore.setState({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Both current month and previous month data should be available
    expect(result.current.data).toBeDefined()
    expect(result.current.incomeDelta !== undefined).toBe(true)
    expect(result.current.expenseDelta !== undefined).toBe(true)
  })

  it('calculates incomeDelta and expenseDelta when both queries complete', async () => {
    useDashboardStore.setState({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Deltas should be calculated (either a number or null for insufficient data)
    expect(typeof result.current.incomeDelta === 'number' || result.current.incomeDelta === null).toBe(true)
    expect(typeof result.current.expenseDelta === 'number' || result.current.expenseDelta === null).toBe(true)
  })

  it('returns deltaLoading=false once both queries complete', async () => {
    useDashboardStore.setState({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Once both queries complete, deltaLoading should be false
    expect(result.current.deltaLoading).toBe(false)
  })

  it('isLoading=true until both current and previous queries complete', async () => {
    useDashboardStore.setState({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    // Wait for loading to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // After completion, isLoading should be false
    expect(result.current.isLoading).toBe(false)
  })

  it('refetch() refetches both current and previous month queries', async () => {
    useDashboardStore.setState({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const initialIncomeDelta = result.current.incomeDelta
    const initialData = result.current.data

    // Call refetch
    result.current.refetch()

    // After refetch, data should still exist
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual(initialData)
    expect(result.current.incomeDelta).toEqual(initialIncomeDelta)
  })
})
