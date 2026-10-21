import { Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MeterBar } from '@/components/ui/MeterBar'
import { formatVND } from '@/utils/currency'
import { computeNetFlow } from '@/utils/cashflow'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'

interface NetCashFlowCardProps {
  totalIncome: number
  totalExpense: number
  transactionCount: number
  isError?: boolean
  onRetry?: () => void
}

/** Ô lớn nhất dashboard: kỳ này dư hay thiếu bao nhiêu (thu − chi, không gồm chuyển nội bộ). */
export function NetCashFlowCard({ totalIncome, totalExpense, transactionCount, isError, onRetry }: NetCashFlowCardProps) {
  const { net, spendRatio } = computeNetFlow(totalIncome, totalExpense)
  const positive = net >= 0
  const animatedNet = useCountUp(net)

  return (
    <Card className="relative h-full overflow-hidden">
      {/* Vệt màu thương hiệu — trang trí, không mang thông tin */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="heading-label text-muted-foreground">Dòng tiền ròng</CardTitle>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Scale className="h-5 w-5" />
        </span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {isError ? (
          <div className="space-y-2">
            <p className="body-sm text-muted-foreground">Không thể tải dữ liệu</p>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="touch-target">Thử lại</Button>}
          </div>
        ) : (
          <>
            <div>
              <p className={cn('heading-display money', positive ? 'text-income' : 'text-expense')}>
                {/* Số chạy chỉ để nhìn; trình đọc màn hình luôn nhận giá trị cuối, không đọc số trung gian */}
                {/* Dấu theo số đang chạy (đổi kỳ từ dư sang thiếu thì dấu đổi đúng lúc số qua 0) */}
                <span aria-hidden="true">{animatedNet >= 0 ? '+' : '–'}{formatVND(animatedNet)}</span>
                <span className="sr-only" data-testid="net-cash-flow">{positive ? '+' : '–'}{formatVND(net)}</span>
              </p>
              <p className="body-sm text-muted-foreground mt-2">
                {transactionCount === 0
                  ? 'Không có giao dịch trong kỳ này'
                  : positive ? 'Kỳ này bạn đang dư' : 'Kỳ này chi vượt thu'}
              </p>
            </div>

            {spendRatio !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Đã chi <span className="font-semibold text-foreground">{spendRatio}%</span> số thu</span>
                </div>
                <MeterBar
                  percent={spendRatio}
                  label="Tỉ lệ chi trên thu"
                  className="bg-income-soft"
                  fillClassName={spendRatio > 100 ? 'bg-expense' : spendRatio >= 80 ? 'bg-warning' : 'bg-income'}
                />
              </div>
            )}

            <p className="mt-auto text-xs text-muted-foreground">Thu − Chi trong kỳ, không gồm chuyển khoản nội bộ.</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
