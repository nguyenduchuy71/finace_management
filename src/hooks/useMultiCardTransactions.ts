import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { TX_PAGE_SIZE, toTxQueryOptions } from '@/services/transactionQuery'
import { useShallow } from 'zustand/react/shallow'
import { getCreditCardTransactions } from '@/services/creditCards'
import { useFilterStore } from '@/stores/filterStore'
import { QK } from './query-keys'

/**
 * Giao dịch của nhiều thẻ một lúc (mục "Nhiều thẻ"), đọc `cardIds` + bộ lọc từ filterStore.
 *
 * Khoá BẮT ĐẦU bằng `'creditCardTransactions'` như danh sách một thẻ: gán MCC (optimistic) và
 * invalidate sau khi sửa/xoá thẻ quét theo tiền tố đó nên tự áp dụng cho cả cache này.
 * Id được sắp xếp: chọn cùng tập thẻ theo thứ tự khác không tạo cache mới.
 */
export function useMultiCardTransactions() {
  const { cardIds, ...filters } = useFilterStore(
    useShallow((s) => ({
      cardIds: s.cardIds,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      searchQuery: s.searchQuery,
      txType: s.txType,
    }))
  )
  const { dateFrom, dateTo, searchQuery, txType } = filters
  const sortedIds = useMemo(() => [...cardIds].sort(), [cardIds])

  return useInfiniteQuery({
    queryKey: [...QK.creditCardTransactions, 'multi', sortedIds, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: ({ pageParam }) =>
      getCreditCardTransactions({ cardIds: sortedIds }, pageParam as string | undefined, TX_PAGE_SIZE, toTxQueryOptions(filters)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
