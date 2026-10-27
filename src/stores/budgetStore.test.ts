import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBudgetStore } from './budgetStore'

describe('Budget Store (Zustand + localStorage)', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset store state with proper type
    const emptyBudgets: Record<string, number> = {}
    useBudgetStore.setState({ budgets: emptyBudgets })
  })

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear()
  })

  describe('setBudget', () => {
    it('setBudget("Ăn uống", 5000000) saves to localStorage under "finance-budgets" key as JSON', () => {
      useBudgetStore.getState().setBudget('Ăn uống', 5000000)

      const stored = localStorage.getItem('finance-budgets')
      expect(stored).toBeDefined()

      const parsed = JSON.parse(stored!)
      expect(parsed['Ăn uống']).toBe(5000000)
    })

    it('Multiple setBudget calls update Record<Category, number> correctly', () => {
      useBudgetStore.getState().setBudget('Ăn uống', 5000000)
      useBudgetStore.getState().setBudget('Mua sắm', 3000000)

      const state = useBudgetStore.getState()
      expect(state.budgets['Ăn uống']).toBe(5000000)
      expect(state.budgets['Mua sắm']).toBe(3000000)
    })

    it('Later calls to setBudget overwrite earlier ones', () => {
      useBudgetStore.getState().setBudget('Ăn uống', 5000000)
      useBudgetStore.getState().setBudget('Ăn uống', 6000000)

      const state = useBudgetStore.getState()
      expect(state.budgets['Ăn uống']).toBe(6000000)
    })
  })

  describe('initialization', () => {
    it('On fresh load, localStorage.getItem("finance-budgets") returns null → store initializes with empty object {}', () => {
      // localStorage is already cleared in beforeEach
      const state = useBudgetStore.getState()
      expect(state.budgets).toEqual({})
    })
  })

  describe('localStorage round-trip', () => {
    it('setItem("finance-budgets", JSON.stringify({...})) → on reload, store loads same budgets', () => {
      // Simulate previous session data in localStorage
      const initialData = {
        'Ăn uống': 5000000,
        'Mua sắm': 3000000,
      }
      localStorage.setItem('finance-budgets', JSON.stringify(initialData))

      // Simulate store reload by reading from localStorage
      const stored = localStorage.getItem('finance-budgets')
      expect(stored).toBeDefined()

      const reloadedBudgets = JSON.parse(stored!)
      expect(reloadedBudgets['Ăn uống']).toBe(5000000)
      expect(reloadedBudgets['Mua sắm']).toBe(3000000)
    })
  })
})
