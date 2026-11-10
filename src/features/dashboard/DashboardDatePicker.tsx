import { useState } from 'react'
import { format, parse } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { isRangeSelectionComplete } from '@/utils/date-range-selection'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useDashboardDateRange, useDashboardStore } from '@/stores/dashboardStore'
import { DASHBOARD_PRESETS, formatPeriodRange } from '@/utils/dashboard-periods'

const CHIP = 'touch-target rounded-full px-4'

/**
 * Chọn kỳ thống kê: preset một chạm + "Tuỳ chọn" (lịch). Cùng một giao diện ở mọi bề rộng
 * (trước đây điện thoại là 2 ô date gốc mm/dd/yyyy, tràn ngang ở 320–360px).
 * Nhãn kỳ luôn hiện để số liệu bên dưới không thiếu ngữ cảnh.
 */
export function DashboardDatePicker() {
  const period = useDashboardStore((s) => s.period)
  const setPeriod = useDashboardStore((s) => s.setPeriod)
  const setDateRange = useDashboardStore((s) => s.setDateRange)
  const { dateFrom, dateTo } = useDashboardDateRange()
  const [open, setOpen] = useState(false)

  // `parse` theo giờ máy — `new Date('yyyy-MM-dd')` là nửa đêm UTC, lệch 1 ngày ở múi giờ âm.
  const selected: DateRange | undefined = dateFrom
    ? { from: toLocalDate(dateFrom), to: dateTo ? toLocalDate(dateTo) : undefined }
    : undefined

  function handleSelect(range: DateRange | undefined) {
    setDateRange(
      range?.from ? format(range.from, 'yyyy-MM-dd') : null,
      range?.to ? format(range.to, 'yyyy-MM-dd') : null,
    )
    if (isRangeSelectionComplete(range)) setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Kỳ thống kê" className="flex flex-wrap gap-2">
        {DASHBOARD_PRESETS.map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant={period === id ? 'default' : 'outline'}
            aria-pressed={period === id}
            className={CHIP}
            onClick={() => setPeriod(id)}
          >
            {label}
          </Button>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={period === 'custom' ? 'default' : 'outline'}
              aria-pressed={period === 'custom'}
              className={cn(CHIP, 'gap-1.5')}
            >
              <CalendarIcon className="h-4 w-4" aria-hidden />
              Tuỳ chọn
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={selected} onSelect={handleSelect} locale={vi} numberOfMonths={1} initialFocus />
          </PopoverContent>
        </Popover>
      </div>
      <p className="body-sm text-muted-foreground" aria-live="polite">
        Kỳ thống kê: <span className="money font-medium text-foreground">{formatPeriodRange(dateFrom, dateTo)}</span>
      </p>
    </div>
  )
}

function toLocalDate(ymd: string): Date {
  return parse(ymd, 'yyyy-MM-dd', new Date())
}
