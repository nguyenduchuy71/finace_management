import { create } from 'zustand'
import type { Category } from '@/types/categories'

interface CategoryOverrideState {
  overrides: Map<string, Category>
  setOverride: (txId: string, category: Category) => void
  clearOverride: (txId: string) => void
  getEffectiveCategory: (txId: string, serverCategory: Category) => Category
}

// Load from localStorage on module init
function getInitialOverrides(): Map<string, Category> {
  const saved = localStorage.getItem('finance-category-overrides')
  if (saved) {
    try {
      return new Map(JSON.parse(saved) as [string, Category][])
    } catch {
      return new Map()
    }
  }
  return new Map()
}

const initialOverrides = getInitialOverrides()

export const useCategoryOverrideStore = create<CategoryOverrideState>()((set, get) => ({
  overrides: initialOverrides,
  setOverride: (txId, category) => {
    set((state) => {
      const newOverrides = new Map(state.overrides)
      newOverrides.set(txId, category)
      localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
      return { overrides: newOverrides }
    })
  },
  clearOverride: (txId) => {
    set((state) => {
      const newOverrides = new Map(state.overrides)
      newOverrides.delete(txId)
      localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
      return { overrides: newOverrides }
    })
  },
  getEffectiveCategory: (txId, serverCategory) => {
    return get().overrides.get(txId) ?? serverCategory
  },
}))
