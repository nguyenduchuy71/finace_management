import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Category } from '@/types/categories'

interface FilterState {
  accountId: string | null
  cardId: string | null
  dateFrom: string | null  // ISO date string "YYYY-MM-DD"
  dateTo: string | null
  searchQuery: string
  txType: 'all' | 'income' | 'expense'
  category: Category | 'all'
  // Actions
  setAccountId: (id: string | null) => void
  setCardId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearchQuery: (q: string) => void
  setTxType: (type: FilterState['txType']) => void
  setCategory: (category: Category | 'all') => void
  resetFilters: () => void
}

const defaultState = {
  accountId: 'vcb-checking-001',  // default to first account for POC render
  cardId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  txType: 'all' as const,
  category: 'all' as const,
}

export const useFilterStore = create<FilterState>()((set) => ({
  ...defaultState,
  setAccountId: (accountId) => set({ accountId }),
  setCardId: (cardId) => set({ cardId }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTxType: (txType) => set({ txType }),
  setCategory: (category) => set({ category }),
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
      category: state.category,
    }))
  )
}
