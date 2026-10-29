import { Filter } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { DateRangePicker } from './DateRangePicker'
import { TransactionTypeFilter } from './TransactionTypeFilter'
import { CategoryFilter } from './CategoryFilter'
import { ExportButton } from './ExportButton'
import { Button } from '@/components/ui/button'
import { useFilterStore, selectHasActiveFilters } from '@/stores/filterStore'

/** `showExport=false`: mục "Nhiều thẻ" — xuất CSV hiện chỉ theo một TK/thẻ. */
export function FilterBar({ showExport = true }: { showExport?: boolean }) {
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const hasActiveFilters = useFilterStore((s) => selectHasActiveFilters(s, { withCategory: true }))

  return (
    <div className="flex flex-wrap gap-3 py-3 border-b border-border">
      <SearchInput />
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
  )
}
