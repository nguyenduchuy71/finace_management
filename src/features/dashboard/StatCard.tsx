import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/utils/currency'
import type { ReactNode } from 'react'

interface StatCardProps {
  variant: 'income' | 'expense'
  amount: number
  transactionCount: number
  delta?: number | null  // NEW: month-over-month percentage
  deltaLoading?: boolean // NEW: true while previous month data still loading
  isError?: boolean
  onRetry?: () => void
  children?: ReactNode  // slot for SourceSubtotals
}

export function StatCard({
  variant,
  amount,
  transactionCount,
  delta,
  deltaLoading,
  isError,
  onRetry,
  children,
}: StatCardProps) {
  const isIncome = variant === 'income'
  const Icon = isIncome ? TrendingUp : TrendingDown
  const label = isIncome ? 'Tổng thu' : 'Tổng chi'
  const colorClass = isIncome
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'

  // Determine delta display message and color
  let deltaMessage: string | null = null
  let deltaColorClass = 'text-muted-foreground'

  if (transactionCount === 0) {
    deltaMessage = null // No delta message for zero transactions
  } else if (deltaLoading === true) {
    deltaMessage = 'Đang tính...'
    deltaColorClass = 'text-muted-foreground'
  } else if (delta === null || transactionCount < 5) {
    deltaMessage = 'Chưa đủ dữ liệu'
    deltaColorClass = 'text-muted-foreground'
  } else if (typeof delta === 'number') {
    const direction = delta >= 0 ? '↑' : '↓'
    const absDelta = Math.abs(delta)
    deltaMessage = `${direction}${absDelta}% vs tháng trước`

    // Determine color based on variant and delta direction
    if (isIncome) {
      // For income: positive (↑) is good (green), negative (↓) is bad (red)
      deltaColorClass = delta >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'
    } else {
      // For expense: positive (↑) is bad (red), negative (↓) is good (green)
      deltaColorClass = delta >= 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-emerald-600 dark:text-emerald-400'
    }
  }

  return (
    <Card className="min-h-[140px] transition-colors duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        {/* heading-label: text-sm font-medium leading-snug — matches card label pattern */}
        <CardTitle className="heading-label text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </CardHeader>
      <CardContent className="card-gap flex flex-col">
        {isError ? (
          <div className="space-y-2">
            <p className="body-sm text-muted-foreground">Không thể tải dữ liệu</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="touch-target">
                Thử lại
              </Button>
            )}
          </div>
        ) : transactionCount === 0 ? (
          <div>
            <p className={`heading-h1 tabular-nums ${colorClass}`}>{formatVND(0)}</p>
            <p className="body-sm text-muted-foreground mt-1">Không có giao dịch trong kỳ này</p>
          </div>
        ) : (
          <div>
            <p className={`heading-h1 tabular-nums ${colorClass}`}>{formatVND(amount)}</p>
            {children}
            {deltaMessage && (
              <p className={`body-sm ${deltaColorClass} mt-1`}>{deltaMessage}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
