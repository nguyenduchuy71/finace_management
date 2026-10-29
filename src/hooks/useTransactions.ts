import { useInfiniteQuery } from '@tanstack/react-query'
import { TX_PAGE_SIZE, emptyTxPage, toTxQueryOptions } from '@/services/transactionQuery'
import { getTransactions } from '@/services/accounts'
import { useFilterParams } from '@/stores/filterStore'
import { QK } from './query-keys'

export function useTransactions() {
  const filters = useFilterParams()
  const { accountId, dateFrom, dateTo, searchQuery, txType, category } = filters

  return useInfiniteQuery({
    queryKey: [...QK.transactions, accountId, { dateFrom, dateTo, searchQuery, txType, category }],
    queryFn: ({ pageParam }) => {
      if (!accountId) return Promise.resolve(emptyTxPage())
      return getTransactions(accountId, pageParam as string | undefined, TX_PAGE_SIZE, toTxQueryOptions(filters))
    },
    initialPageParam: undefined as string | undefined,
    // CRITICAL: return undefined (not null) to signal no more pages — TanStack Query v5 uses undefined as sentinel
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accountId),
  })
}
