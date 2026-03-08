import { create } from 'zustand'
import type { BudgetState } from '@/types/budget'

// Load from localStorage on module init
function getInitialBudgets(): Record<string, number> {
  const saved = localStorage.getItem('finance-budgets')
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, number>
    } catch {
      return {}
    }
  }
  return {}
}

const initialBudgets = getInitialBudgets()

export const useBudgetStore = create<BudgetState>()((set) => ({
  budgets: initialBudgets,
  setBudget: (category, amount) => {
    set((state) => {
      const newBudgets = { ...state.budgets, [category]: amount }
      localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
      return { budgets: newBudgets }
    })
  },
  clearBudget: (category) => {
    set((state) => {
      const newBudgets = { ...state.budgets }
      delete newBudgets[category]
      localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
      return { budgets: newBudgets }
    })
  },
  getBudget: (category) => {
    const state = useBudgetStore.getState()
    return state.budgets[category] ?? 0
  },
}))
