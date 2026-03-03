import { useTransactions } from '@/hooks/useTransactions'
import { useFilterParams } from '@/stores/filterStore'
import { TransactionRow } from './TransactionRow'
import { TransactionListSkeleton } from './TransactionListSkeleton'
import { TransactionEmptyState } from './TransactionEmptyState'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export function TransactionList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions()
  const { searchQuery, dateFrom, dateTo, txType } = useFilterParams()

  const hasActiveFilters = Boolean(searchQuery || dateFrom || dateTo || txType !== 'all')

  if (isLoading) return <TransactionListSkeleton count={7} />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="font-medium text-destructive">Không thể tải giao dịch</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(error as { message?: string })?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.'}
        </p>
      </div>
    )
  }

  const allTransactions = data?.pages.flatMap((page) => page.data) ?? []

  if (allTransactions.length === 0) {
    return <TransactionEmptyState hasFilters={hasActiveFilters} />
  }

  return (
    <div className="space-y-2">
      {allTransactions.map((tx) => (
        <TransactionRow key={tx.id} transaction={tx} />
      ))}

      {hasNextPage && (
        <div className="pt-2 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
          </Button>
        </div>
      )}

      {!hasNextPage && allTransactions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          Đã hiển thị tất cả {allTransactions.length} giao dịch
        </p>
      )}
    </div>
  )
}
