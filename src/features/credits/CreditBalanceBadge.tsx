import { Coins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCreditBalance, useHeldCount } from '@/hooks/useCredits'
import { cn } from '@/lib/utils'
import { LOW_CREDIT_THRESHOLD, UNLIMITED_LABEL } from '@/types/credit'

/**
 * Số dư credit ở header. Cảnh báo (viền warning) khi dưới ngưỡng hoặc có tin đang chờ nạp credit —
 * lúc đó bấm vào để tới hộp tin. Ẩn khi chưa tải được: không hiện số 0 giả làm user tưởng hết credit.
 */
export function CreditBalanceBadge({ className }: { className?: string }) {
  const balance = useCreditBalance()
  const held = useHeldCount()
  if (!balance.data) return null

  const { unlimited, balance: amount } = balance.data
  const heldCount = held.data ?? 0
  const warn = !unlimited && (amount < LOW_CREDIT_THRESHOLD || heldCount > 0)
  const label = unlimited ? UNLIMITED_LABEL : `${amount} credit`
  const title = heldCount > 0 ? `${heldCount} tin đang chờ nạp credit` : unlimited ? UNLIMITED_LABEL : `Còn ${amount} credit`

  return (
    <Link
      to={heldCount > 0 ? '/accounts?view=inbox' : '/settings'}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:bg-accent',
        warn ? 'border-warning text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <Coins className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
      {heldCount > 0 && <span className="rounded-full bg-warning px-1.5 text-[10px] font-semibold text-black">{heldCount} chờ</span>}
    </Link>
  )
}
