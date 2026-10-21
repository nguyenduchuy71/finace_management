import { useMemo } from 'react'
import { useCreditCardTransactions } from '@/hooks/useCreditCardTransactions'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useNow } from '@/hooks/useNow'
import { useFilterStore } from '@/stores/filterStore'
import { groupTransactionsByCycle, computeCurrentCycle } from '@/utils/billingCycle'
import { BillingCycleGroup } from './BillingCycleGroup'
import { CreditCardTransactionListSkeleton } from './CreditCardTransactionListSkeleton'
import { LoadMoreFooter } from '@/features/transactions/LoadMoreFooter'
import { AlertCircle, Receipt, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/empty-state/EmptyState'

export function CreditCardTransactionList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCreditCardTransactions()
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const dateFrom = useFilterStore((s) => s.dateFrom)
  const dateTo = useFilterStore((s) => s.dateTo)
  const txType = useFilterStore((s) => s.txType)
  const cardId = useFilterStore((s) => s.cardId)

  const { data: cardsData } = useCreditCards()
  // useCreditCards uses useQuery (not useInfiniteQuery) — data is PaginatedResponse<CreditCard> directly
  const card = cardsData?.data?.find((c) => c.id === cardId) ?? null

  const allTransactions = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  )

  // Tự cập nhật (cùng đồng hồ với BillingCycleInfoCard): tab mở qua mốc cắt sao kê thì nhóm
  // "Chu kỳ hiện tại" phải sang kỳ mới, nếu không hai khối trên trang sẽ hiện hai chu kỳ khác nhau.
  const now = useNow()
  const statementDate = card?.statementDate
  const currentCycle = useMemo(
    () => statementDate !== undefined ? computeCurrentCycle(statementDate, now) : null,
    [statementDate, now]
  )
  const cycleGroups = useMemo(
    () => currentCycle && statementDate !== undefined
      ? groupTransactionsByCycle(allTransactions, currentCycle, statementDate)
      : [],
    [allTransactions, currentCycle, statementDate]
  )

  const hasActiveFilters = Boolean(searchQuery || dateFrom || dateTo || txType !== 'all')

  if (isLoading) return <CreditCardTransactionListSkeleton count={7} />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="font-medium text-destructive">Không thể tải giao dịch thẻ</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(error as { message?: string })?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.'}
        </p>
      </div>
    )
  }

  if (allTransactions.length === 0) {
    return (
      <EmptyState
        icon={hasActiveFilters ? SearchX : Receipt}
        title={hasActiveFilters ? 'Không có giao dịch phù hợp' : 'Chưa có giao dịch thẻ'}
        description={hasActiveFilters
          ? 'Thử điều chỉnh bộ lọc hoặc xóa bộ lọc.'
          : 'Giao dịch thẻ tín dụng sẽ xuất hiện ở đây.'}
      />
    )
  }

  return (
    <div className="space-y-4">
      {cycleGroups.map((group) => (
        <BillingCycleGroup key={group.cycleKey} group={group} />
      ))}

      <LoadMoreFooter
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        loadedCount={allTransactions.length}
      />
    </div>
  )
}
