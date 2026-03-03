import { formatCycleDateRange } from '@/utils/billingCycle'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import type { BillingCycleGroupData } from '@/utils/billingCycle'

interface BillingCycleGroupProps {
  group: BillingCycleGroupData
}

export function BillingCycleGroup({ group }: BillingCycleGroupProps) {
  const { startDisplay, endDisplay } = formatCycleDateRange(
    group.cycleStartISO,
    group.cycleEndISO
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 py-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {group.isCurrentCycle ? 'Chu kỳ hiện tại' : 'Chu kỳ trước'}
        </h3>
        <span className="text-xs text-muted-foreground">
          {startDisplay} – {endDisplay}
        </span>
      </div>
      <div className="space-y-2">
        {group.transactions.map((tx) => (
          <CreditCardTransactionRow key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  )
}
