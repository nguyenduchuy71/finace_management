import { useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Category } from '@/types/categories'
import type { CategoryBreakdownItem } from '@/services/dashboard'

export interface BudgetAlert {
  category: Category
  percent: number
  level: 'warning' | 'overbudget'
  spent: number
  budget: number
}

/**
 * Pure function: compute budget alerts from items with spent/budget data.
 * Returns alerts for categories at >=80% usage, sorted by percent descending.
 */
export function computeBudgetAlerts(
  items: Array<{ category: Category; spent: number; budget: number }>
): BudgetAlert[] {
  return items
    .filter((item) => item.budget > 0)
    .map((item) => {
      const percent = Math.round((item.spent / item.budget) * 100)
      return {
        category: item.category,
        percent,
        level: (percent >= 100 ? 'overbudget' : 'warning') as 'warning' | 'overbudget',
        spent: item.spent,
        budget: item.budget,
      }
    })
    .filter((alert) => alert.percent >= 80)
    .sort((a, b) => b.percent - a.percent)
}

/**
 * Hook: computes budget alerts and fires sonner toasts on mount.
 * Toasts fire at most once per mount (deduped via useRef flag).
 */
export function useBudgetAlerts(
  categoryBreakdown: CategoryBreakdownItem[],
  budgets: Record<Category, number>
): { alerts: BudgetAlert[]; warningCount: number; overbudgetCount: number } {
  // Build items array: map over budget keys, lookup spent from categoryBreakdown
  const spentMap = useMemo(
    () =>
      Object.fromEntries(
        categoryBreakdown.map((item) => [item.category, item.amount])
      ),
    [categoryBreakdown]
  )

  const alerts = useMemo(() => {
    const items = Object.entries(budgets)
      .filter(([, amount]) => amount > 0)
      .map(([cat, budget]) => ({
        category: cat as Category,
        spent: spentMap[cat] ?? 0,
        budget,
      }))
    return computeBudgetAlerts(items)
  }, [budgets, spentMap])

  const hasFired = useRef(false)

  useEffect(() => {
    if (hasFired.current || alerts.length === 0) return
    hasFired.current = true

    for (const alert of alerts) {
      if (alert.level === 'overbudget') {
        toast.error(`${alert.category}: đã vượt ngân sách (${alert.percent}%)`)
      } else {
        toast.warning(
          `${alert.category}: sắp đạt giới hạn ngân sách (${alert.percent}%)`
        )
      }
    }
  }, [alerts])

  const warningCount = alerts.filter((a) => a.level === 'warning').length
  const overbudgetCount = alerts.filter((a) => a.level === 'overbudget').length

  return { alerts, warningCount, overbudgetCount }
}
