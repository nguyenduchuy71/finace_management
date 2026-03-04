import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@/services/dashboard'
import { useDashboardDateRange } from '@/stores/dashboardStore'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()

  return useQuery({
    queryKey: ['dashboardStats', { dateFrom, dateTo }],
    queryFn: () => getDashboardStats({ dateFrom, dateTo }),
    staleTime: 1000 * 60 * 5,
  })
}
