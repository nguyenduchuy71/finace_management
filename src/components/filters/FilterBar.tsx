import { useState } from 'react'
import { Filter, SlidersHorizontal } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { DateRangePicker } from './DateRangePicker'
import { TransactionTypeFilter } from './TransactionTypeFilter'
import { CategoryFilter } from './CategoryFilter'
import { ExportButton } from './ExportButton'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useFilterStore, selectHasActiveFilters } from '@/stores/filterStore'

/** Số bộ lọc đang bật ngoài ô tìm kiếm (ô tìm luôn hiện nên không đếm). */
function useSheetFilterCount() {
  return useFilterStore((s) => (s.dateFrom || s.dateTo ? 1 : 0) + (s.category !== 'all' ? 1 : 0) + (s.txType !== 'all' ? 1 : 0))
}

/**
 * Thanh lọc dùng chung cho 3 danh sách giao dịch.
 * >= sm: mọi control trên một hàng. < sm: ô tìm + nút "Bộ lọc (n)" mở sheet — trước đây 5 control
 * xếp 3 hàng chiếm ~200px trước dòng giao dịch đầu tiên ở 375px.
 * `showExport=false`: mục "Nhiều thẻ" — xuất CSV hiện chỉ theo một TK/thẻ.
 */
export function FilterBar({ showExport = true }: { showExport?: boolean }) {
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const hasActiveFilters = useFilterStore((s) => selectHasActiveFilters(s))
  const sheetCount = useSheetFilterCount()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex flex-wrap gap-3 py-3 border-b border-border">
      <SearchInput />

      <Button
        variant="outline"
        className="touch-target gap-2 sm:hidden"
        aria-haspopup="dialog"
        aria-label={sheetCount > 0 ? `Bộ lọc, ${sheetCount} đang bật` : 'Bộ lọc'}
        onClick={() => setSheetOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Bộ lọc
        {sheetCount > 0 && (
          <span aria-hidden className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {sheetCount}
          </span>
        )}
      </Button>

      <div className="hidden sm:contents">
        <DateRangePicker />
        <CategoryFilter />
        <TransactionTypeFilter />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="touch-target text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <Filter className="h-4 w-4 mr-1.5 opacity-60" />
            Xóa bộ lọc
          </Button>
        )}
        {showExport && <ExportButton />}
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bộ lọc</DialogTitle>
            <DialogDescription>Áp dụng ngay khi chọn.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <DateRangePicker className="w-full max-w-none" />
            <CategoryFilter className="w-full" />
            <TransactionTypeFilter className="w-full" />
            {showExport && <ExportButton />}
          </div>
          <DialogFooter>
            {hasActiveFilters && (
              <Button variant="outline" onClick={resetFilters}>Xóa bộ lọc</Button>
            )}
            <Button onClick={() => setSheetOpen(false)}>Xem kết quả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
