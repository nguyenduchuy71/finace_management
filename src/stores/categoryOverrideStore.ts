import { create } from 'zustand'
import type { Category } from '@/types/categories'

interface CategoryOverrideState {
  overrides: Map<string, Category>
  setOverride: (txId: string, category: Category) => void
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

export const useCategoryOverrideStore = create<CategoryOverrideState>()((set) => ({
  overrides: initialOverrides,
  setOverride: (txId, category) => {
    set((state) => {
      const newOverrides = new Map(state.overrides)
      newOverrides.set(txId, category)
      localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
      return { overrides: newOverrides }
    })
  },
}))
