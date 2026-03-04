import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

interface DashboardState {
  dateFrom: string | null  // ISO date string "YYYY-MM-DD"
  dateTo: string | null
  setDateRange: (from: string | null, to: string | null) => void
  resetDateRange: () => void
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  dateFrom: null,
  dateTo: null,
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  resetDateRange: () => set({ dateFrom: null, dateTo: null }),
}))

export function useDashboardDateRange() {
  return useDashboardStore(
    useShallow((state) => ({
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
    }))
  )
}
