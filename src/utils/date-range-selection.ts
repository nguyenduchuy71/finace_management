import type { DateRange } from 'react-day-picker'

/**
 * Đã chọn xong khoảng ngày chưa (để tự đóng lịch).
 * react-day-picker v9: lần bấm ĐẦU trả `{ from: d, to: d }` — nếu coi `from && to` là xong thì lịch đóng
 * ngay sau một lần bấm và không bao giờ chọn được khoảng nhiều ngày một mạch (đã gặp ở cả bộ lọc giao dịch).
 * Khoảng một ngày: user tự đóng (bấm ra ngoài / Esc).
 */
export function isRangeSelectionComplete(range: DateRange | undefined): boolean {
  return Boolean(range?.from && range.to && range.from.getTime() !== range.to.getTime())
}
