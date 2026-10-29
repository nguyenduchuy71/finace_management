import { create } from 'zustand'
import type { BudgetState } from '@/types/budget'
import { readJSON, writeJSON } from '@/lib/persisted-json'

const BUDGETS_KEY = 'finance-budgets'

const isBudgetRecord = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const initialBudgets = readJSON<Record<string, number>>(BUDGETS_KEY, {}, isBudgetRecord)

export const useBudgetStore = create<BudgetState>()((set) => ({
  budgets: initialBudgets,
  setBudget: (category, amount) => {
    set((state: BudgetState) => {
      const newBudgets = { ...state.budgets, [category]: amount }
      writeJSON(BUDGETS_KEY, newBudgets)
      return { budgets: newBudgets }
    })
  },
}))
