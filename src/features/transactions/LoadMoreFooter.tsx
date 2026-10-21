import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoadMoreFooterProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  loadedCount: number
  /** Tổng khớp bộ lọc — chỉ trang đầu có (`pages[0].total`); 0/thiếu = không rõ thì ẩn dòng "x / y". */
  totalCount?: number
}

/** Chân danh sách giao dịch (ngân hàng, một thẻ, nhiều thẻ): nút "Xem thêm" (mỗi lần TX_PAGE_SIZE dòng) hoặc báo đã hết. */
export function LoadMoreFooter({ hasNextPage, isFetchingNextPage, onLoadMore, loadedCount, totalCount = 0 }: LoadMoreFooterProps) {
  if (hasNextPage) {
    return (
      <div className="flex flex-col items-center gap-2 pt-2">
        {totalCount > loadedCount && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Đang hiện <span className="money font-medium text-foreground">{loadedCount}</span> /{' '}
            <span className="money">{totalCount}</span> giao dịch
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          aria-busy={isFetchingNextPage}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {isFetchingNextPage && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
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
