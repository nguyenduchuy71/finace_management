import { Filter } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { DateRangePicker } from './DateRangePicker'
import { TransactionTypeFilter } from './TransactionTypeFilter'
import { Button } from '@/components/ui/button'
import { useFilterStore } from '@/stores/filterStore'

export function FilterBar() {
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const dateFrom = useFilterStore((s) => s.dateFrom)
  const dateTo = useFilterStore((s) => s.dateTo)
  const txType = useFilterStore((s) => s.txType)

  const hasActiveFilters = Boolean(searchQuery || dateFrom || dateTo || txType !== 'all')

  return (
    <div className="flex flex-wrap gap-3 py-3 border-b border-border">
      <SearchInput />
      <DateRangePicker />
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
    </div>
  )
}
