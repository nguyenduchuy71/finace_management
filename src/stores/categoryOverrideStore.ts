import { create } from 'zustand'
import type { Category } from '@/types/categories'
import { readJSON, writeJSON } from '@/lib/persisted-json'

interface CategoryOverrideState {
  overrides: Map<string, Category>
  setOverride: (txId: string, category: Category) => void
}

const OVERRIDES_KEY = 'finance-category-overrides'

const isList = (v: unknown): v is unknown[] => Array.isArray(v)

// Lưu dạng mảng [txId, category]; bỏ dòng sai hình dạng thay vì loại cả danh sách.
const isEntry = (e: unknown): e is [string, Category] =>
  Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string'

const initialOverrides = new Map(
  readJSON<unknown[]>(OVERRIDES_KEY, [], isList).filter(isEntry),
)

export const useCategoryOverrideStore = create<CategoryOverrideState>()((set) => ({
  overrides: initialOverrides,
  setOverride: (txId, category) => {
    set((state) => {
      const newOverrides = new Map(state.overrides)
      newOverrides.set(txId, category)
      writeJSON(OVERRIDES_KEY, [...newOverrides])
      return { overrides: newOverrides }
    })
  },
}))
