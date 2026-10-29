import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/categories'

interface CategoryBadgeProps {
  category: Category
  className?: string
}

// Token ngữ nghĩa `--cat-n` / `--cat-n-soft` (index.css, đo WCAG AA ở cả hai theme), n khớp `--chart-n`
// trong utils/category-colors.ts. Class viết nguyên chuỗi để Tailwind quét được.
const categoryColorMap: Record<Category, string> = {
  'Ăn uống': 'bg-cat-1-soft text-cat-1',
  'Mua sắm': 'bg-cat-2-soft text-cat-2',
  'Di chuyển': 'bg-cat-3-soft text-cat-3',
  'Giải trí': 'bg-cat-4-soft text-cat-4',
  'Hóa đơn': 'bg-cat-5-soft text-cat-5',
  'Khác': 'bg-cat-6-soft text-cat-6',
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <Badge variant="secondary" className={cn(categoryColorMap[category], className)}>
      {category}
    </Badge>
  )
}
