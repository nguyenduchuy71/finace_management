import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/utils/currency'
import type { ReactNode } from 'react'

interface StatCardProps {
  variant: 'income' | 'expense'
  amount: number
  transactionCount: number
  isError?: boolean
  onRetry?: () => void
  children?: ReactNode  // slot for SourceSubtotals
}

export function StatCard({ variant, amount, transactionCount, isError, onRetry, children }: StatCardProps) {
  const isIncome = variant === 'income'
  const Icon = isIncome ? TrendingUp : TrendingDown
  const label = isIncome ? 'Tổng thu' : 'Tổng chi'
  const colorClass = isIncome
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <Card className="min-h-[140px]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Không thể tải dữ liệu</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="min-h-[44px]">
                Thử lại
              </Button>
            )}
          </div>
        ) : transactionCount === 0 ? (
          <div>
            <p className={`text-2xl font-bold ${colorClass}`}>{formatVND(0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Không có giao dịch trong kỳ này</p>
          </div>
        ) : (
          <div>
            <p className={`text-2xl font-bold ${colorClass}`}>{formatVND(amount)}</p>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
