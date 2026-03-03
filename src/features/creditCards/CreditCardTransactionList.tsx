import { useCreditCardTransactions } from '@/hooks/useCreditCardTransactions'
import { useFilterStore } from '@/stores/filterStore'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import { CreditCardTransactionListSkeleton } from './CreditCardTransactionListSkeleton'
import { Button } from '@/components/ui/button'
import { AlertCircle, SearchX } from 'lucide-react'

export function CreditCardTransactionList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCreditCardTransactions()
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const dateFrom = useFilterStore((s) => s.dateFrom)
  const dateTo = useFilterStore((s) => s.dateTo)
  const txType = useFilterStore((s) => s.txType)

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

  const allTransactions = data?.pages.flatMap((page) => page.data) ?? []

  if (allTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <SearchX className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium">
          {hasActiveFilters ? 'Không có giao dịch phù hợp' : 'Chưa có giao dịch thẻ'}
        </p>
        <p className="text-sm mt-1">
          {hasActiveFilters
            ? 'Thử điều chỉnh bộ lọc hoặc xóa bộ lọc.'
            : 'Giao dịch thẻ tín dụng sẽ xuất hiện ở đây.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allTransactions.map((tx) => (
        <CreditCardTransactionRow key={tx.id} transaction={tx} />
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
