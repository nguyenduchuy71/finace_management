import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useFilterStore } from '@/stores/filterStore'
import { CATEGORY_TAXONOMY, getCategoryLabel } from '@/utils/categories'
import type { Category } from '@/types/categories'

export function CategoryFilter() {
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)

  const displayLabel = category === 'all' ? 'Danh mục' : getCategoryLabel(category)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[140px] min-h-[44px]"
        >
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setCategory('all')}
            className="text-left text-sm p-2 rounded hover:bg-accent transition-colors duration-200"
          >
            Tất cả
          </button>
          {Object.keys(CATEGORY_TAXONOMY).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat as Category)}
              className="text-left text-sm p-2 rounded hover:bg-accent transition-colors duration-200"
            >
              {getCategoryLabel(cat as Category)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
