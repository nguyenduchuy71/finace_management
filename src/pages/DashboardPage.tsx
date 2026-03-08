import { lazy, Suspense } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { DashboardDatePicker } from '@/features/dashboard/DashboardDatePicker'
import { StatCard } from '@/features/dashboard/StatCard'
import { StatCardSkeleton } from '@/features/dashboard/StatCardSkeleton'
import { SourceSubtotals } from '@/features/dashboard/SourceSubtotals'
import { CategoryChartSkeleton } from '@/features/dashboard/CategoryChartSkeleton'
import { BudgetProgressSection } from '@/features/dashboard/BudgetProgressSection'

// Recharts is ~372KB — lazy-load CategoryChart so recharts chunk only loads on dashboard mount.
// CategoryChartSkeleton (no recharts dependency) shows while the chunk is fetched.
const CategoryChart = lazy(() =>
  import('@/features/dashboard/CategoryChart').then((m) => ({ default: m.CategoryChart }))
)

export function DashboardPage() {
  const { data, incomeDelta, expenseDelta, deltaLoading, isLoading, isError, refetch } =
    useDashboardStats()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
      </div>

      {/* Date range picker — prominent at top, independent of main filter store */}
      <DashboardDatePicker />

      {/* Stats grid — 3 columns on lg, 1 column on mobile */}
      {/* Col 1: Income, Col 2: Expenses, Col 3: Chart (placeholder, filled in 04-02) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Income card */}
        {isLoading ? (
          <StatCardSkeleton />
        ) : (
          <StatCard
            variant="income"
            amount={data?.totalIncome ?? 0}
            transactionCount={data?.transactionCount ?? 0}
            delta={incomeDelta}
            deltaLoading={deltaLoading}
            isError={isError}
            onRetry={refetch}
          >
            {data && (
              <SourceSubtotals
                variant="income"
                bankAmount={data.bankIncome}
                ccAmount={data.ccIncome}
              />
            )}
          </StatCard>
        )}

        {/* Expense card */}
        {isLoading ? (
          <StatCardSkeleton />
        ) : (
          <StatCard
            variant="expense"
            amount={data?.totalExpense ?? 0}
            transactionCount={data?.transactionCount ?? 0}
            delta={expenseDelta}
            deltaLoading={deltaLoading}
            isError={isError}
            onRetry={refetch}
          >
            {data && (
              <SourceSubtotals
                variant="expense"
                bankAmount={data.bankExpense}
                ccAmount={data.ccExpense}
              />
            )}
          </StatCard>
        )}

        {/* CategoryChart is lazy-loaded (recharts chunk deferred until dashboard mount).
            CategoryChartSkeleton is shown while the recharts chunk loads.
            CRITICAL: useMemo dep [categoryBreakdown] only — see CategoryChart comment. */}
        <div className="sm:col-span-2 lg:col-span-1">
          {isLoading ? (
            <CategoryChartSkeleton />
          ) : (
            <Suspense fallback={<CategoryChartSkeleton />}>
              <CategoryChart categoryBreakdown={data?.categoryBreakdown ?? []} />
            </Suspense>
          )}
        </div>
      </div>

      {/* Budget Progress Section — appears after stat cards when budgets are set */}
      {data && <BudgetProgressSection categoryBreakdown={data.categoryBreakdown} />}
    </div>
  )
}
