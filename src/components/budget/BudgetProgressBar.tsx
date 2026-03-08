import { formatVND } from '@/utils/currency'
import type { Category } from '@/types/categories'

interface BudgetProgressBarProps {
  category: Category
  spent: number
  budget: number
  className?: string
}

export function BudgetProgressBar({ category, spent, budget, className = '' }: BudgetProgressBarProps) {
  // Guard: if budget === 0, return null (no budget set → hidden, not rendered)
  if (budget === 0) {
    return null
  }

  // Calculation: percent = Math.min(Math.round((spent / budget) * 100), 100)
  const percent = Math.round((spent / budget) * 100)
  const cappedPercent = Math.min(percent, 100)

  // Color logic
  const isOverBudget = percent >= 100
  const isWarning = percent >= 80 && percent < 100

  const fillColorClass = isOverBudget
    ? 'bg-red-600 dark:bg-red-500'
    : isWarning
      ? 'bg-yellow-500 dark:bg-yellow-400'
      : 'bg-emerald-600 dark:bg-emerald-500'

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header: category label | percent label */}
      <div className="flex items-center justify-between">
        <span className="heading-label text-muted-foreground">{category}</span>
        <span className="heading-label text-muted-foreground">{percent}%</span>
      </div>

      {/* Progress bar: full width, bg-slate-200, rounded-full, conditional fill */}
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          data-testid="budget-fill"
          className={`h-full ${fillColorClass} transition-all duration-300`}
          style={{ width: `${cappedPercent}%` }}
        />
      </div>

      {/* Sub-text: "formatVND(spent) / formatVND(budget)" in small text, muted color */}
      <p className="body-sm text-muted-foreground text-right">
        {formatVND(spent)} / {formatVND(budget)}
      </p>
    </div>
  )
}
