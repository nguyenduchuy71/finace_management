import { useInfiniteQuery } from '@tanstack/react-query'
import { getCreditCardTransactions } from '@/services/creditCards'
import { useFilterStore } from '@/stores/filterStore'
import { useShallow } from 'zustand/react/shallow'

function useCreditCardFilterParams() {
  return useFilterStore(
    useShallow((state) => ({
      cardId: state.cardId,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      searchQuery: state.searchQuery,
      txType: state.txType,
    }))
  )
}

export function useCreditCardTransactions() {
  const { cardId, dateFrom, dateTo, searchQuery, txType } = useCreditCardFilterParams()

  return useInfiniteQuery({
    queryKey: ['creditCardTransactions', cardId, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: ({ pageParam }) => {
      if (!cardId) return Promise.resolve({ data: [], nextCursor: null, total: 0 })
      return getCreditCardTransactions(cardId, pageParam as string | undefined, 20, {
        search: searchQuery || undefined,
        dateFrom,
        dateTo,
        txType,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(cardId),
  })
}
