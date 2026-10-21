import { cn } from '@/lib/utils'

interface MeterBarProps {
  /** 0..100 — giá trị ngoài khoảng bị kẹp. */
  percent: number
  /** Nhãn cho trình đọc màn hình (thanh luôn có chữ đi kèm bên cạnh, đây là bổ sung). */
  label: string
  /** Class màu phần đã đầy, vd `bg-cashback-strong`. */
  fillClassName?: string
  className?: string
}

/** Thanh tiến độ mỏng dùng chung (chu kỳ sao kê, trần hoàn tiền, bậc thang...). */
export function MeterBar({ percent, label, fillClassName = 'bg-primary', className }: MeterBarProps) {
  const value = Math.round(Math.min(100, Math.max(0, percent)))
  return (
    <div
      role="progressbar" aria-label={label}
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', fillClassName)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
