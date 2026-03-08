import { useQueries } from '@tanstack/react-query'
import { getDashboardStats } from '@/services/dashboard'
import { useDashboardDateRange } from '@/stores/dashboardStore'
import { getPreviousMonthDateRange, calculateMonthDelta } from '@/utils/dates'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()

  // Calculate previous month date range
  const { prevFrom, prevTo } = getPreviousMonthDateRange(dateFrom, dateTo)

  // Fetch both current and previous month stats in parallel using useQueries
  const [currentQuery, previousQuery] = useQueries({
    queries: [
      {
        queryKey: ['dashboardStats', { dateFrom, dateTo }],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }],
        queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }),
        staleTime: 1000 * 60 * 5,
      },
    ],
  })

  // Compute deltas only when both queries are loaded
  let incomeDelta: number | null = null
  let expenseDelta: number | null = null

  if (currentQuery.data && previousQuery.data && !previousQuery.isLoading) {
    incomeDelta = calculateMonthDelta(currentQuery.data.totalIncome, previousQuery.data.totalIncome)
    expenseDelta = calculateMonthDelta(currentQuery.data.totalExpense, previousQuery.data.totalExpense)
  }

  return {
    data: currentQuery.data,
    incomeDelta,
    expenseDelta,
    deltaLoading: previousQuery.isLoading && !currentQuery.isLoading,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
    refetch: () => {
      currentQuery.refetch()
      previousQuery.refetch()
    },
  }
}
