import { useMemo } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useNow } from '@/hooks/useNow'
import { formatDayLabel, groupByDay } from '@/utils/group-by-day'
import { DayGroupHeader } from './DayGroupHeader'
import { useFilterStore, selectHasActiveFilters } from '@/stores/filterStore'
import { TransactionRow } from './TransactionRow'
import { TransactionListSkeleton } from './TransactionListSkeleton'
import { TransactionEmptyState } from './TransactionEmptyState'
import { LoadMoreFooter } from './LoadMoreFooter'
import { TransactionListError } from './TransactionListError'

export function TransactionList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions()
  const hasActiveFilters = useFilterStore((s) => selectHasActiveFilters(s, { withCategory: true }))

  // useMemo: flatMap trong thân render chạy lại mỗi lần re-render (đổi filter,
  // debounce search...) trên toàn bộ tập đã tải. CreditCardTransactionList đã làm
  // đúng như vậy; file này trước đây là chỗ lệch chuẩn.
  // PHẢI đặt TRƯỚC mọi early return: hook gọi có điều kiện là vi phạm Rules of Hooks.
  const allTransactions = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  )
  const dayGroups = useMemo(() => groupByDay(allTransactions), [allTransactions])
  // "Hôm nay"/"Hôm qua" tự đổi khi tab mở qua nửa đêm
  const now = useNow()

  if (isLoading) return <TransactionListSkeleton count={7} />

  if (isError) return <TransactionListError title="Không thể tải giao dịch" error={error} />

  if (allTransactions.length === 0) {
    return <TransactionEmptyState hasFilters={hasActiveFilters} />
  }

  return (
    <div className="space-y-4">
      {dayGroups.map((g) => (
        <section key={g.dayKey} aria-label={formatDayLabel(g.dayKey, now)}>
          <DayGroupHeader label={formatDayLabel(g.dayKey, now)} income={g.income} expense={g.expense} />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {g.items.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)}
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
