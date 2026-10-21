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
    <section className="space-y-1">
      <div className="sticky top-14 z-10 -mx-1 flex items-baseline gap-2 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {group.isCurrentCycle ? 'Chu kỳ hiện tại' : 'Chu kỳ trước'}
        </h3>
        <span className="text-xs text-muted-foreground">
          {startDisplay} – {endDisplay}
        </span>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {group.transactions.map((tx) => (
          <CreditCardTransactionRow key={tx.id} transaction={tx} />
        ))}
      </ul>
    </section>
  )
}
