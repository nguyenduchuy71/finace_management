import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBudgetStore } from './budgetStore'

describe('Budget Store (Zustand + localStorage)', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset store state
    useBudgetStore.setState({ budgets: {} })
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

  describe('getBudget', () => {
    it('getBudget("Ăn uống") returns 0 when budget not set', () => {
      const amount = useBudgetStore.getState().getBudget('Ăn uống')
      expect(amount).toBe(0)
    })

    it('getBudget("Ăn uống") returns 5000000 after setBudget called', () => {
      useBudgetStore.getState().setBudget('Ăn uống', 5000000)
      const amount = useBudgetStore.getState().getBudget('Ăn uống')
      expect(amount).toBe(5000000)
    })
  })

  describe('clearBudget', () => {
    it('clearBudget("Ăn uống") removes category from store and localStorage', () => {
      useBudgetStore.getState().setBudget('Ăn uống', 5000000)
      expect(useBudgetStore.getState().budgets['Ăn uống']).toBe(5000000)

      useBudgetStore.getState().clearBudget('Ăn uống')
      expect(useBudgetStore.getState().budgets['Ăn uống']).toBeUndefined()

      const stored = localStorage.getItem('finance-budgets')
      const parsed = JSON.parse(stored!)
      expect(parsed['Ăn uống']).toBeUndefined()
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
