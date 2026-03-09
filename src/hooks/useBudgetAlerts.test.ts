import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { computeBudgetAlerts, useBudgetAlerts } from './useBudgetAlerts'
import type { Category } from '@/types/categories'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock budgetStore
vi.mock('@/stores/budgetStore', () => ({
  useBudgetStore: vi.fn(() => ({ budgets: {} })),
}))

import { toast } from 'sonner'

describe('computeBudgetAlerts', () => {
  // Test 1: warning at 90%
  it('returns warning alert when spent is 90% of budget', () => {
    const result = computeBudgetAlerts([
      { category: 'Ăn uống' as Category, spent: 900, budget: 1000 },
    ])
    expect(result).toEqual([
      {
        category: 'Ăn uống',
        percent: 90,
        level: 'warning',
        spent: 900,
        budget: 1000,
      },
    ])
  })

  // Test 2: overbudget at 120%
  it('returns overbudget alert when spent exceeds budget', () => {
    const result = computeBudgetAlerts([
      { category: 'Ăn uống' as Category, spent: 1200, budget: 1000 },
    ])
    expect(result).toEqual([
      {
        category: 'Ăn uống',
        percent: 120,
        level: 'overbudget',
        spent: 1200,
        budget: 1000,
      },
    ])
  })

  // Test 3: no alert when under 80%
  it('returns empty array when spent is under 80% of budget', () => {
    const result = computeBudgetAlerts([
      { category: 'Ăn uống' as Category, spent: 500, budget: 1000 },
    ])
    expect(result).toEqual([])
  })

  // Test 4: no alert when budget is 0
  it('returns empty array when budget is 0 (no budget set)', () => {
    const result = computeBudgetAlerts([
      { category: 'Ăn uống' as Category, spent: 500, budget: 0 },
    ])
    expect(result).toEqual([])
  })

  // Test 5: multiple categories sorted by percent descending
  it('returns alerts sorted by percent descending (worst first)', () => {
    const result = computeBudgetAlerts([
      { category: 'Ăn uống' as Category, spent: 850, budget: 1000 },
      { category: 'Mua sắm' as Category, spent: 1500, budget: 1000 },
      { category: 'Di chuyển' as Category, spent: 950, budget: 1000 },
    ])
    expect(result).toHaveLength(3)
    expect(result[0].category).toBe('Mua sắm')
    expect(result[0].percent).toBe(150)
    expect(result[1].category).toBe('Di chuyển')
    expect(result[1].percent).toBe(95)
    expect(result[2].category).toBe('Ăn uống')
    expect(result[2].percent).toBe(85)
  })
})

describe('useBudgetAlerts hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 6: fires toast.warning for warning-level alerts on mount
  it('calls toast.warning for warning-level alerts on mount', () => {
    const categoryBreakdown = [{ category: 'Ăn uống', amount: 900000 }]
    const budgets = { 'Ăn uống': 1000000 } as Record<Category, number>

    renderHook(() => useBudgetAlerts(categoryBreakdown, budgets))

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Ăn uống')
    )
  })

  // Test 7: fires toast.error for overbudget-level alerts on mount
  it('calls toast.error for overbudget-level alerts on mount', () => {
    const categoryBreakdown = [{ category: 'Ăn uống', amount: 1200000 }]
    const budgets = { 'Ăn uống': 1000000 } as Record<Category, number>

    renderHook(() => useBudgetAlerts(categoryBreakdown, budgets))

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Ăn uống')
    )
  })

  // Test 8: does NOT fire toasts when no alerts exist
  it('does NOT fire toasts when no alerts exist', () => {
    const categoryBreakdown = [{ category: 'Ăn uống', amount: 500000 }]
    const budgets = { 'Ăn uống': 1000000 } as Record<Category, number>

    renderHook(() => useBudgetAlerts(categoryBreakdown, budgets))

    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  // Test 9: returns alerts, warningCount, overbudgetCount
  it('returns alerts, warningCount, and overbudgetCount for badge rendering', () => {
    const categoryBreakdown = [
      { category: 'Ăn uống', amount: 900000 },
      { category: 'Mua sắm', amount: 1200000 },
    ]
    const budgets = {
      'Ăn uống': 1000000,
      'Mua sắm': 1000000,
    } as Record<Category, number>

    const { result } = renderHook(() =>
      useBudgetAlerts(categoryBreakdown, budgets)
    )

    expect(result.current.alerts).toHaveLength(2)
    expect(result.current.warningCount).toBe(1)
    expect(result.current.overbudgetCount).toBe(1)
  })
})
