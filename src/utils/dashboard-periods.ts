import { TZDate } from '@date-fns/tz'
import { endOfMonth, format, parse, startOfMonth, subMonths } from 'date-fns'
import { VN_TZ } from './dates'

/** Kỳ thống kê của dashboard: preset tính theo ngày Việt Nam, hoặc khoảng tuỳ chọn. */
export type DashboardPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'all' | 'custom'
export type DashboardPreset = Exclude<DashboardPeriod, 'custom'>

export interface DateRangeValue {
  dateFrom: string | null // "YYYY-MM-DD"
  dateTo: string | null
}

export const DEFAULT_DASHBOARD_PERIOD: DashboardPreset = 'this_month'

export const DASHBOARD_PRESETS: readonly { id: DashboardPreset; label: string }[] = [
  { id: 'this_month', label: 'Tháng này' },
  { id: 'last_month', label: 'Tháng trước' },
  { id: 'last_3_months', label: '3 tháng' },
  { id: 'all', label: 'Tất cả' },
]

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

/** Khoảng ngày của preset tại thời điểm `nowISO` (theo lịch VN — 23:30 UTC ngày 31 đã là tháng sau ở VN). */
export function presetRange(period: DashboardPreset, nowISO: string = new Date().toISOString()): DateRangeValue {
  const now = new TZDate(nowISO, VN_TZ)
  switch (period) {
    case 'this_month':
      return { dateFrom: ymd(startOfMonth(now)), dateTo: ymd(endOfMonth(now)) }
    case 'last_month': {
      const prev = subMonths(now, 1)
      return { dateFrom: ymd(startOfMonth(prev)), dateTo: ymd(endOfMonth(prev)) }
    }
    case 'last_3_months':
      return { dateFrom: ymd(startOfMonth(subMonths(now, 2))), dateTo: ymd(endOfMonth(now)) }
    case 'all':
      return { dateFrom: null, dateTo: null }
  }
}

/**
 * Khoảng có đúng bằng MỘT tháng dương lịch trọn vẹn không. Chỉ khi đó so "% vs tháng trước" mới có
 * nghĩa — so 3 tháng hay toàn bộ thời gian với 1 tháng là so táo với cam.
 */
export function isWholeCalendarMonth(dateFrom: string | null, dateTo: string | null): boolean {
  if (!dateFrom || !dateTo) return false
  const d = parse(dateFrom, 'yyyy-MM-dd', new Date())
  return ymd(startOfMonth(d)) === dateFrom && ymd(endOfMonth(d)) === dateTo
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" bằng tách chuỗi: không qua Date nên không lệch múi giờ. */
function toDisplay(value: string): string {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

/** Nhãn kỳ luôn hiện dưới bộ chọn, để số liệu không bao giờ thiếu ngữ cảnh "kỳ nào". */
export function formatPeriodRange(dateFrom: string | null, dateTo: string | null): string {
  if (dateFrom && dateTo) return `${toDisplay(dateFrom)} – ${toDisplay(dateTo)}`
  if (dateFrom) return `Từ ${toDisplay(dateFrom)}`
  if (dateTo) return `Đến ${toDisplay(dateTo)}`
  return 'Toàn bộ thời gian'
}
