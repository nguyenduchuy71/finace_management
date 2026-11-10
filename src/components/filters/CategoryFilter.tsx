import { useState } from 'react'
import { Check, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/stores/filterStore'
import { CATEGORY_TAXONOMY, getCategoryLabel } from '@/utils/categories'
import type { Category } from '@/types/categories'

const OPTIONS: (Category | 'all')[] = ['all', ...(Object.keys(CATEGORY_TAXONOMY) as Category[])]

/** Lọc theo danh mục. Đánh dấu mục đang chọn và đóng ngay khi chọn (trước đây popover đứng nguyên). */
export function CategoryFilter({ className }: { className?: string }) {
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)
  const [open, setOpen] = useState(false)

  const label = (c: Category | 'all') => (c === 'all' ? 'Mọi danh mục' : getCategoryLabel(c))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-[160px] min-h-[44px] justify-start gap-2', className)}>
          <Tag className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="truncate">{category === 'all' ? 'Danh mục' : getCategoryLabel(category)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div role="group" aria-label="Danh mục" className="flex flex-col">
          {OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => { setCategory(c); setOpen(false) }}
              className="flex min-h-[40px] items-center justify-between gap-2 rounded-md px-2 text-left text-sm transition-colors duration-200 hover:bg-accent"
            >
              {label(c)}
              {category === c && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
