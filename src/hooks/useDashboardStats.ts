import { useQueries } from '@tanstack/react-query'
import { getDashboardStats } from '@/services/dashboard'
import { useDashboardDateRange } from '@/stores/dashboardStore'
import { getPreviousMonthDateRange, calculateMonthDelta } from '@/utils/dates'
import { isWholeCalendarMonth } from '@/utils/dashboard-periods'
import { QK } from './query-keys'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()

  // "% vs tháng trước" chỉ có nghĩa khi kỳ đang xem là đúng một tháng trọn vẹn; kỳ khác thì
  // không tải tháng trước và không hiện delta (trước đây "toàn bộ thời gian" bị so với 1 tháng).
  const compareAvailable = isWholeCalendarMonth(dateFrom, dateTo)
  const { prevFrom, prevTo } = getPreviousMonthDateRange(dateFrom)

  // Fetch both current and previous month stats in parallel using useQueries
  const [currentQuery, previousQuery] = useQueries({
    queries: [
      {
        queryKey: [...QK.dashboardStats, { dateFrom, dateTo }],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: [...QK.dashboardStats, { dateFrom: prevFrom, dateTo: prevTo }],
        queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }),
        staleTime: 1000 * 60 * 5,
        enabled: compareAvailable,
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
    compareAvailable,
    deltaLoading: previousQuery.isLoading && !currentQuery.isLoading,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
    refetch: () => {
      currentQuery.refetch()
      // refetch() bỏ qua `enabled` — tự chặn để không tải tháng trước khi không so sánh
      if (compareAvailable) previousQuery.refetch()
    },
  }
}
