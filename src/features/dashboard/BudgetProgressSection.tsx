import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar'
import { BudgetSettings } from '@/components/budget/BudgetSettings'
import { useBudgetStore } from '@/stores/budgetStore'
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts'
import type { CategoryBreakdownItem } from '@/services/dashboard'
import type { Category } from '@/types/categories'

interface BudgetProgressSectionProps {
  categoryBreakdown: CategoryBreakdownItem[]
}

export function BudgetProgressSection({ categoryBreakdown }: BudgetProgressSectionProps) {
  const { budgets } = useBudgetStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { warningCount, overbudgetCount } = useBudgetAlerts(categoryBreakdown, budgets)
  const alertCount = warningCount + overbudgetCount

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm text-muted-foreground">Tiến độ ngân sách</CardTitle>
            {alertCount > 0 && (
              overbudgetCount > 0 ? (
                <Badge
                  data-testid="alert-badge"
                  variant="destructive"
                  className="text-xs"
                >
                  {alertCount}
                </Badge>
              ) : (
                <span
                  data-testid="alert-badge"
                  data-variant="warning"
                  className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-200"
                >
                  {alertCount}
                </span>
              )
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="touch-target"
            aria-label="Cài đặt ngân sách"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
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

      <BudgetSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Card>
  )
}
