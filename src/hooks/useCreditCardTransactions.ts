import { useInfiniteQuery } from '@tanstack/react-query'
import { TX_PAGE_SIZE, emptyTxPage, toTxQueryOptions } from '@/services/transactionQuery'
import { getCreditCardTransactions } from '@/services/creditCards'
import { useCreditCardFilterParams } from '@/stores/filterStore'
import { QK } from './query-keys'

export function useCreditCardTransactions() {
  const filters = useCreditCardFilterParams()
  const { cardId, dateFrom, dateTo, searchQuery, txType } = filters

  return useInfiniteQuery({
    queryKey: [...QK.creditCardTransactions, cardId, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: ({ pageParam }) => {
      if (!cardId) return Promise.resolve(emptyTxPage())
      return getCreditCardTransactions(cardId, pageParam as string | undefined, TX_PAGE_SIZE, toTxQueryOptions(filters))
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(cardId),
  })
}
