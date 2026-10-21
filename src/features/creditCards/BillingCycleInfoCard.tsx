import { useMemo } from 'react'
import { useNow } from '@/hooks/useNow'
import { computeCurrentCycle } from '@/utils/billingCycle'
import type { CreditCard } from '@/types/creditCard'
import { CardVisual } from './CardVisual'
import { CycleProgress } from './CycleProgress'
import { CashbackSummary } from './CashbackSummary'

interface BillingCycleInfoCardProps {
  card: CreditCard
}

/** Khối "ví": thẻ vật lý + tiến độ chu kỳ (trái) và hoàn tiền ước tính (phải) trên màn rộng. */
export function BillingCycleInfoCard({ card }: BillingCycleInfoCardProps) {
  // Tự cập nhật: tab mở qua mốc cắt sao kê thì chu kỳ và hoàn tiền ước tính phải sang kỳ mới.
  const now = useNow()
  const cycle = useMemo(
    () => computeCurrentCycle(card.statementDate, now),
    [card.statementDate, now]
  )

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[340px_1fr] lg:gap-6">
      <div className="space-y-4">
        {/* key: đổi thẻ thì thẻ mới "trượt vào" (chỉ khi người dùng cho phép chuyển động) */}
        <div key={card.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-300">
          <CardVisual card={card} />
        </div>
        <CycleProgress cycle={cycle} nowISO={now} />
      </div>
      <CashbackSummary card={card} cycle={cycle} />
    </div>
  )
}
