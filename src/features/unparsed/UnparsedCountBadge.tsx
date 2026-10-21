import { useUnparsedCount } from '@/hooks/useUnparsedMessages'
import { cn } from '@/lib/utils'

/** Số tin chưa phân loại (không tính quảng cáo). Ẩn khi 0 hoặc chưa tải được. */
export function UnparsedCountBadge({ className }: { className?: string }) {
  const { data: count } = useUnparsedCount()
  if (!count) return null
  return (
    <span
      className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white', className)}
      aria-label={`${count} tin chưa phân loại`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
