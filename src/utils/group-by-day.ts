import { TZDate } from '@date-fns/tz'
import { format, subDays } from 'date-fns'

const VN_TZ = 'Asia/Ho_Chi_Minh'
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

export interface DayGroup<T> {
  /** Ngày theo giờ VN, `yyyy-MM-dd` — dùng làm key. */
  dayKey: string
  /** Tổng thu (dương) / tổng chi (dương) của các dòng ĐÃ TẢI trong ngày. */
  income: number
  expense: number
  items: T[]
}

/** Ngày lịch VN của một thời điểm UTC (giao dịch 23:30 UTC đã là sáng hôm sau ở VN). */
export function vnDayKey(iso: string): string {
  return format(new TZDate(iso, VN_TZ), 'yyyy-MM-dd')
}

/**
 * Nhóm giao dịch theo ngày VN, giữ nguyên thứ tự đầu vào (danh sách đã sắp mới nhất trước).
 * Nhóm lại trên TOÀN BỘ các trang đã tải mỗi lần: trang mới nối vào giữa một ngày vẫn gộp đúng nhóm.
 */
export function groupByDay<T extends { transactionDate: string; amount: number }>(items: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  const byKey = new Map<string, DayGroup<T>>()
  for (const item of items) {
    const key = vnDayKey(item.transactionDate)
    let g = byKey.get(key)
    if (!g) {
      g = { dayKey: key, income: 0, expense: 0, items: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(item)
    if (item.amount > 0) g.income += item.amount
    else g.expense += -item.amount
  }
  return groups
}

/** "Hôm nay" / "Hôm qua" / "Thứ hai, 19/10/2026" — so theo ngày VN của `nowISO`. */
export function formatDayLabel(dayKey: string, nowISO: string): string {
  const today = vnDayKey(nowISO)
  if (dayKey === today) return 'Hôm nay'
  if (dayKey === vnDayKey(subDays(new Date(nowISO), 1).toISOString())) return 'Hôm qua'
  const [y, m, d] = dayKey.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}
