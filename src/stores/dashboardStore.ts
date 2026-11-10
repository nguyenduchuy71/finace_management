import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  DEFAULT_DASHBOARD_PERIOD,
  presetRange,
  type DashboardPeriod,
  type DashboardPreset,
  type DateRangeValue,
} from '@/utils/dashboard-periods'

interface DashboardState {
  period: DashboardPeriod
  /** Chỉ dùng khi `period === 'custom'`; preset tính lại lúc đọc (tab mở qua mốc tháng vẫn đúng). */
  dateFrom: string | null // ISO date string "YYYY-MM-DD"
  dateTo: string | null
  setPeriod: (period: DashboardPreset) => void
  /** Khoảng tuỳ chọn từ lịch → period = 'custom'. */
  setDateRange: (from: string | null, to: string | null) => void
  resetDateRange: () => void
}

/** Trạng thái đầu: "Tháng này" (trước đây null = toàn bộ thời gian nhưng thẻ lại ghi "Kỳ này"). */
export const DASHBOARD_INITIAL_STATE = { period: DEFAULT_DASHBOARD_PERIOD, dateFrom: null, dateTo: null } as const

export const useDashboardStore = create<DashboardState>()((set) => ({
  ...DASHBOARD_INITIAL_STATE,
  setPeriod: (period) => set({ period, dateFrom: null, dateTo: null }),
  setDateRange: (dateFrom, dateTo) => set({ period: 'custom', dateFrom, dateTo }),
  resetDateRange: () => set({ ...DASHBOARD_INITIAL_STATE }),
}))

/** Khoảng ngày đang áp dụng (preset → tính theo hôm nay ở VN; custom → giá trị đã chọn). */
export function useDashboardDateRange(): DateRangeValue {
  const { period, dateFrom, dateTo } = useDashboardStore(
    useShallow((s) => ({ period: s.period, dateFrom: s.dateFrom, dateTo: s.dateTo })),
  )
  return period === 'custom' ? { dateFrom, dateTo } : presetRange(period)
}
