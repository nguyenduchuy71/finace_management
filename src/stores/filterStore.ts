import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Category } from '@/types/categories'

interface FilterState {
  accountId: string | null
  cardId: string | null
  /** Mục "Nhiều thẻ" của trang thẻ; rỗng = tất cả thẻ. Độc lập với `cardId` (mục "Từng thẻ"). */
  cardIds: string[]
  dateFrom: string | null  // ISO date string "YYYY-MM-DD"
  dateTo: string | null
  searchQuery: string
  txType: 'all' | 'income' | 'expense'
  category: Category | 'all'
  // Actions
  setAccountId: (id: string | null) => void
  setCardId: (id: string | null) => void
  setCardIds: (ids: string[]) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearchQuery: (q: string) => void
  setTxType: (type: FilterState['txType']) => void
  setCategory: (category: Category | 'all') => void
  resetFilters: () => void
}

const defaultState = {
  accountId: null,   // AccountTabs tự chọn tài khoản đầu tiên sau khi load từ Supabase
  cardId: null,
  cardIds: [] as string[],
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
  setCardIds: (cardIds) => set({ cardIds }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTxType: (txType) => set({ txType }),
  setCategory: (category) => set({ category }),
  resetFilters: () => set(defaultState),
}))

/**
 * Có bộ lọc nào đang bật không. Trả boolean nguyên thuỷ nên không cần useShallow.
 * `withCategory=false` cho thẻ tín dụng: thẻ không có bộ lọc danh mục.
 */
export function selectHasActiveFilters(
  s: Pick<FilterState, 'searchQuery' | 'dateFrom' | 'dateTo' | 'txType' | 'category'>,
  { withCategory }: { withCategory: boolean },
): boolean {
  return Boolean(
    s.searchQuery || s.dateFrom || s.dateTo || s.txType !== 'all' || (withCategory && s.category !== 'all')
  )
}

/** Như `useFilterParams` nhưng cho một thẻ (không có danh mục) — cũng PHẢI dùng useShallow. */
export function useCreditCardFilterParams() {
  return useFilterStore(
    useShallow((state) => ({
      cardId: state.cardId,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      searchQuery: state.searchQuery,
      txType: state.txType,
    }))
  )
}

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
