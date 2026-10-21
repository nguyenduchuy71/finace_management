import { CalendarClock } from 'lucide-react'
import { MeterBar } from '@/components/ui/MeterBar'
import { cn } from '@/lib/utils'
import type { BillingCycle } from '@/utils/billingCycle'
import { cycleProgressPercent, cycleUrgency, type CycleUrgency } from '@/utils/cycle-progress'

const URGENCY_STYLE: Record<CycleUrgency, { fill: string; chip: string }> = {
  calm: { fill: 'bg-primary', chip: 'bg-primary/10 text-primary' },
  soon: { fill: 'bg-warning', chip: 'bg-cashback-soft text-cashback' },
  urgent: { fill: 'bg-expense', chip: 'bg-expense-soft text-expense' },
}

/**
 * Dòng thời gian của chu kỳ sao kê: ngày bắt đầu → hôm nay → ngày sao kê.
 * Số ngày còn lại luôn hiện bằng chữ — màu chỉ là tín hiệu phụ.
 */
export function CycleProgress({ cycle, nowISO }: { cycle: BillingCycle; nowISO: string }) {
  const percent = cycleProgressPercent(cycle.startISO, cycle.endISO, nowISO)
  const style = URGENCY_STYLE[cycleUrgency(cycle.daysUntilClose)]

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock aria-hidden className="h-4 w-4 text-muted-foreground" />
          Chu kỳ sao kê hiện tại
        </h3>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', style.chip)}>
          Còn {cycle.daysUntilClose} ngày
        </span>
      </div>
      <MeterBar percent={percent} label="Thời gian đã qua của chu kỳ sao kê" fillClassName={style.fill} />
      <div className="flex justify-between text-xs">
        <div>
          <p className="text-muted-foreground">Bắt đầu chu kỳ</p>
          <p className="font-medium money">{cycle.startDisplay}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Ngày sao kê</p>
          <p className="font-medium money">{cycle.statementDateDisplay}</p>
        </div>
      </div>
    </div>
  )
}
