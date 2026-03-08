import { Badge } from '@/components/ui/badge'
import type { Category } from '@/types/categories'

interface CategoryBadgeProps {
  category: Category
  className?: string
}

const categoryColorMap: Record<Category, string> = {
  'Ăn uống': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  'Mua sắm': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
  'Di chuyển': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  'Giải trí': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  'Hóa đơn': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  'Khác': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  return (
    <Badge variant="secondary" className={`${categoryColorMap[category]} ${className}`}>
      {category}
    </Badge>
  )
}
