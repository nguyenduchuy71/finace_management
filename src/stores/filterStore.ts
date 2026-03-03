import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

interface FilterState {
  accountId: string | null
  cardId: string | null
  dateFrom: string | null  // ISO date string "YYYY-MM-DD"
  dateTo: string | null
  searchQuery: string
  txType: 'all' | 'income' | 'expense'
  // Actions
  setAccountId: (id: string | null) => void
  setCardId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearchQuery: (q: string) => void
  setTxType: (type: FilterState['txType']) => void
  resetFilters: () => void
}

const defaultState = {
  accountId: 'vcb-checking-001',  // default to first account for POC render
  cardId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  txType: 'all' as const,
}

export const useFilterStore = create<FilterState>()((set) => ({
  ...defaultState,
  setAccountId: (accountId) => set({ accountId }),
  setCardId: (cardId) => set({ cardId }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTxType: (txType) => set({ txType }),
  resetFilters: () => set(defaultState),
}))

/**
 * Selector for multiple filter params — MUST use useShallow to prevent
 * infinite re-renders from object reference inequality on every render.
 */
export function useFilterParams() {
  return useFilterStore(
    useShallow((state) => ({
      accountId: state.accountId,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      searchQuery: state.searchQuery,
      txType: state.txType,
    }))
  )
}
