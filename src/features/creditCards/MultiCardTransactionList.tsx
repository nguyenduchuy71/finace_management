import { useMemo } from 'react'
import { Receipt, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { useMultiCardTransactions } from '@/hooks/useMultiCardTransactions'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useNow } from '@/hooks/useNow'
import { useFilterStore, selectHasActiveFilters } from '@/stores/filterStore'
import { formatDayLabel, groupByDay } from '@/utils/group-by-day'
import { LoadMoreFooter } from '@/features/transactions/LoadMoreFooter'
import { DayGroupHeader } from '@/features/transactions/DayGroupHeader'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import { CreditCardTransactionListSkeleton } from './CreditCardTransactionListSkeleton'
import { TransactionListError } from '@/features/transactions/TransactionListError'

/**
 * Một dòng thời gian gộp giao dịch của nhiều thẻ, nhóm theo NGÀY (mỗi thẻ có ngày sao kê khác nhau
 * nên không nhóm theo chu kỳ). Mỗi dòng ghi rõ thẻ, vẫn gán MCC được tại chỗ.
 */
export function MultiCardTransactionList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMultiCardTransactions()
  const hasActiveFilters = useFilterStore((s) => selectHasActiveFilters(s, { withCategory: false }))
  const { data: cardsData } = useCreditCards()
  const now = useNow()

  const cardById = useMemo(
    () => new Map((cardsData?.data ?? []).map((c) => [c.id, c])),
    [cardsData]
  )
  const allTransactions = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data])
  const dayGroups = useMemo(() => groupByDay(allTransactions), [allTransactions])
  // count chính xác từ DB chỉ có ở trang đầu (totalForPage bỏ count từ trang 2)
  const total = data?.pages[0]?.total ?? 0

  if (isLoading) return <CreditCardTransactionListSkeleton count={7} />

  if (isError) return <TransactionListError title="Không thể tải giao dịch thẻ" error={error} />

  if (allTransactions.length === 0) {
    return (
      <EmptyState
        icon={hasActiveFilters ? SearchX : Receipt}
        title={hasActiveFilters ? 'Không có giao dịch phù hợp' : 'Các thẻ đã chọn chưa có giao dịch'}
        description={hasActiveFilters ? 'Thử điều chỉnh bộ lọc hoặc xóa bộ lọc.' : 'Chọn thêm thẻ hoặc xem "Tất cả thẻ".'}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-semibold text-foreground money">{total}</span> giao dịch
      </p>
      {dayGroups.map((g) => (
        <section key={g.dayKey} aria-label={formatDayLabel(g.dayKey, now)}>
          <DayGroupHeader label={formatDayLabel(g.dayKey, now)} income={g.income} expense={g.expense} />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {g.items.map((tx) => (
              <CreditCardTransactionRow key={tx.id} transaction={tx} card={cardById.get(tx.cardId)} />
            ))}
          </ul>
        </section>
      ))}

      <LoadMoreFooter
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        loadedCount={allTransactions.length}
        totalCount={data?.pages[0]?.total}
      />
    </div>
  )
}
