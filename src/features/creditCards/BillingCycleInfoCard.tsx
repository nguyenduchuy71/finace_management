import { useMemo } from 'react'
import { computeCurrentCycle } from '@/utils/billingCycle'
import { Badge } from '@/components/ui/badge'
import type { CreditCard } from '@/types/creditCard'

interface BillingCycleInfoCardProps {
  card: CreditCard
}

export function BillingCycleInfoCard({ card }: BillingCycleInfoCardProps) {
  const now = useMemo(() => new Date().toISOString(), [])
  const cycle = useMemo(
    () => computeCurrentCycle(card.statementDate, now),
    [card.statementDate, now]
  )

  const urgencyVariant = cycle.daysUntilClose <= 3
    ? 'destructive'
    : cycle.daysUntilClose <= 7
    ? 'secondary'
    : 'default'

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Chu kỳ sao kê hiện tại</h3>
        <Badge variant={urgencyVariant}>
          Còn {cycle.daysUntilClose} ngày
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Bắt đầu chu kỳ</p>
          <p className="font-medium">{cycle.startDisplay}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ngày sao kê</p>
          <p className="font-medium">{cycle.statementDateDisplay}</p>
        </div>
      </div>
    </div>
  )
}
