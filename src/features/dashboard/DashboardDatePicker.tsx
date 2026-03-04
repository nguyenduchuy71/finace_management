import { useState } from 'react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDashboardStore } from '@/stores/dashboardStore'

export function DashboardDatePicker() {
  const { dateFrom, dateTo, setDateRange, resetDateRange } = useDashboardStore()
  const [open, setOpen] = useState(false)

  // Desktop Calendar popover — only shown on sm+ screens
  const range: DateRange | undefined = dateFrom
    ? { from: new Date(dateFrom), to: dateTo ? new Date(dateTo) : undefined }
    : undefined

  function handleDesktopSelect(selected: DateRange | undefined) {
    if (!selected) {
      setDateRange(null, null)
      return
    }
    const from = selected.from ? format(selected.from, 'yyyy-MM-dd') : null
    const to = selected.to ? format(selected.to, 'yyyy-MM-dd') : null
    setDateRange(from, to)
    // Close popover when both dates selected
    if (selected.from && selected.to) setOpen(false)
  }

  function handleNativeFrom(e: React.ChangeEvent<HTMLInputElement>) {
    setDateRange(e.target.value || null, dateTo)
  }

  function handleNativeTo(e: React.ChangeEvent<HTMLInputElement>) {
    setDateRange(dateFrom, e.target.value || null)
  }

  const displayLabel = dateFrom
    ? `${dateFrom}${dateTo ? ' → ' + dateTo : ''}`
    : 'Chọn khoảng thời gian'

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-foreground">Kỳ thống kê:</span>

      {/* Mobile: native date inputs (visible only on mobile) */}
      <div className="flex items-center gap-2 sm:hidden">
        <input
          type="date"
          value={dateFrom ?? ''}
          onChange={handleNativeFrom}
          className="min-h-[48px] rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Từ ngày"
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="date"
          value={dateTo ?? ''}
          onChange={handleNativeTo}
          className="min-h-[48px] rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Đến ngày"
        />
      </div>

      {/* Desktop: Calendar popover (hidden on mobile) */}
      <div className="hidden sm:flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="min-h-[44px] justify-start gap-2 text-left font-normal"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className={dateFrom ? '' : 'text-muted-foreground'}>{displayLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleDesktopSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={resetDateRange}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Xóa bộ lọc ngày"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Mobile clear button */}
      {(dateFrom || dateTo) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetDateRange}
          className="sm:hidden min-h-[44px] text-muted-foreground"
        >
          Xóa lọc
        </Button>
      )}
    </div>
  )
}
