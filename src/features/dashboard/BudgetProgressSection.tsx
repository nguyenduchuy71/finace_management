import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar'
import { useBudgetStore } from '@/stores/budgetStore'
import type { CategoryBreakdownItem } from '@/services/dashboard'
import type { Category } from '@/types/categories'

interface BudgetProgressSectionProps {
  categoryBreakdown: CategoryBreakdownItem[]
}

export function BudgetProgressSection({ categoryBreakdown }: BudgetProgressSectionProps) {
  const { budgets } = useBudgetStore()

  // Guard: if no budgets are set, return null (hide entire section)
  const hasBudgets = Object.values(budgets).some((b) => b > 0)
  if (!hasBudgets) {
    return null
  }

  // Build a map: category -> spent amount for fast lookup
  const categoryMap = Object.fromEntries(
    categoryBreakdown.map((item) => [item.category, item.amount])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Tiến độ ngân sách</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(budgets).map((cat) => {
          const category = cat as Category
          const budget = budgets[category]

          // Skip if budget is 0 (BudgetProgressBar also guards this, but we check here too)
          if (budget === 0) {
            return null
          }

          const spent = categoryMap[category] ?? 0

          return (
            <BudgetProgressBar
              key={category}
              category={category}
              spent={spent}
              budget={budget}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
