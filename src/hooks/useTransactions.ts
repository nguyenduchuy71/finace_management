import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactions } from '@/services/accounts'
import { useFilterParams } from '@/stores/filterStore'

export function useTransactions() {
  const { accountId, dateFrom, dateTo, searchQuery, txType } = useFilterParams()

  return useInfiniteQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: ({ pageParam }) => {
      if (!accountId) return Promise.resolve({ data: [], nextCursor: null, total: 0 })
      return getTransactions(accountId, pageParam as string | undefined, 20, {
        search: searchQuery || undefined,
        dateFrom,
        dateTo,
        txType,
      })
    },
    initialPageParam: undefined as string | undefined,
    // CRITICAL: return undefined (not null) to signal no more pages — TanStack Query v5 uses undefined as sentinel
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accountId),
  })
}
