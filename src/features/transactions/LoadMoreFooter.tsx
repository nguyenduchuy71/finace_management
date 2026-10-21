import { Button } from '@/components/ui/button'

interface LoadMoreFooterProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  loadedCount: number
}

/** Chân danh sách giao dịch (ngân hàng, một thẻ, nhiều thẻ): nút "Xem thêm" hoặc báo đã hết. */
export function LoadMoreFooter({ hasNextPage, isFetchingNextPage, onLoadMore, loadedCount }: LoadMoreFooterProps) {
  if (hasNextPage) {
    return (
      <div className="pt-2 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
        </Button>
      </div>
    )
  }
  if (loadedCount === 0) return null
  return (
    <p className="text-center text-xs text-muted-foreground py-4">
      Đã hiển thị tất cả {loadedCount} giao dịch
    </p>
  )
}
