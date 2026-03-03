import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '@/services/accounts'
import { useFilterParams } from '@/stores/filterStore'

export function useTransactions() {
  // Reading filter state into the query key means TanStack Query automatically
  // re-fetches when any filter changes — this is the correct data ownership boundary.
  // API data lives in TanStack Query cache; filter state lives in Zustand.
  const { accountId, dateFrom, dateTo, searchQuery, txType } = useFilterParams()

  return useQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: () => {
      if (!accountId) return { data: [], nextCursor: null, total: 0 }
      return getTransactions(accountId)
    },
    enabled: Boolean(accountId),
  })
}
