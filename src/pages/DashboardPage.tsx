import { LayoutDashboard } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { DashboardDatePicker } from '@/features/dashboard/DashboardDatePicker'
import { StatCard } from '@/features/dashboard/StatCard'
import { StatCardSkeleton } from '@/features/dashboard/StatCardSkeleton'
import { SourceSubtotals } from '@/features/dashboard/SourceSubtotals'
import { CategoryChart } from '@/features/dashboard/CategoryChart'
import { CategoryChartSkeleton } from '@/features/dashboard/CategoryChartSkeleton'

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardStats()

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

        {/* CategoryChart is memoized — only re-renders when dateFrom/dateTo changes.
            Changing searchQuery or account in main filterStore does NOT trigger chart re-animation.
            Reason: useDashboardStats uses dashboardStore (independent) not filterStore. */}
        <div className="sm:col-span-2 lg:col-span-1">
          {isLoading ? (
            <CategoryChartSkeleton />
          ) : (
            <CategoryChart categoryBreakdown={data?.categoryBreakdown ?? []} />
          )}
        </div>
      </div>
    </div>
  )
}
