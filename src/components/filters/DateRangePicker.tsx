import { useState } from 'react'
import { format, parse } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { useFilterStore } from '@/stores/filterStore'

export function DateRangePicker() {
  const setDateRange = useFilterStore((s) => s.setDateRange)
  const dateFrom = useFilterStore((s) => s.dateFrom)
  const dateTo = useFilterStore((s) => s.dateTo)
  const [open, setOpen] = useState(false)

  // Lấy thẳng từ store, không giữ bản sao: "Xóa bộ lọc" (resetFilters) từng để picker hiện khoảng ngày cũ.
  // `parse` theo giờ máy — `new Date('yyyy-MM-dd')` là nửa đêm UTC, lệch 1 ngày ở múi giờ âm.
  const selected: DateRange | undefined = dateFrom
    ? { from: toLocalDate(dateFrom), to: dateTo ? toLocalDate(dateTo) : undefined }
    : undefined

  function handleSelect(range: DateRange | undefined) {
    setDateRange(
      range?.from ? format(range.from, 'yyyy-MM-dd') : null,
      range?.to ? format(range.to, 'yyyy-MM-dd') : null,
    )
    // Close popover when both dates selected
    if (range?.from && range?.to) setOpen(false)
  }

  function handleClear() {
    setDateRange(null, null)
  }

  const hasSelection = Boolean(selected?.from)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start min-h-[44px] max-w-[280px]"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate text-sm">
            {selected?.from
              ? selected.to
                ? `${format(selected.from, 'dd/MM/yy')} – ${format(selected.to, 'dd/MM/yy')}`
                : format(selected.from, 'dd/MM/yyyy')
              : 'Chọn khoảng ngày'}
          </span>
          {hasSelection && (
            <X
              className="ml-auto h-3 w-3 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          locale={vi}
          disabled={(d) => d > new Date()}
          numberOfMonths={1}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function toLocalDate(ymd: string): Date {
  return parse(ymd, 'yyyy-MM-dd', new Date())
}
