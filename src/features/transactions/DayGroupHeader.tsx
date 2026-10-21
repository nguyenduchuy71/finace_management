import { formatVND } from '@/utils/currency'

interface DayGroupHeaderProps {
  label: string
  income: number
  expense: number
}

/**
 * Tiêu đề ngày dính dưới app header (h-14) khi cuộn. Tổng chỉ gồm các dòng ĐÃ TẢI —
 * ngày bị cắt giữa hai trang sẽ cộng đủ khi tải tiếp (nhóm lại trên toàn bộ trang).
 */
export function DayGroupHeader({ label, income, expense }: DayGroupHeaderProps) {
  return (
    <div className="sticky top-14 z-10 -mx-1 flex items-baseline justify-between gap-3 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <p className="money flex gap-3 text-xs font-medium">
        {income > 0 && <span className="text-income">+{formatVND(income)}</span>}
        {expense > 0 && <span className="text-expense">–{formatVND(expense)}</span>}
      </p>
    </div>
  )
}
