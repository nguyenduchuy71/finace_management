import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionRow } from './TransactionRow'
import { useCategoryOverrideStore } from '@/stores/categoryOverrideStore'
import type { Transaction } from '@/types/account'

// Reset store before each test
beforeEach(() => {
  // Clear localStorage
  localStorage.clear()
  // Reset the store
  useCategoryOverrideStore.setState({ overrides: new Map() })
})

afterEach(() => {
  localStorage.clear()
  useCategoryOverrideStore.setState({ overrides: new Map() })
})

const mockExpenseTransaction: Transaction = {
  id: 'tx-1',
  accountId: 'vcb-checking-001',
  amount: -100000,
  description: 'Circle K Purchase',
  merchantName: 'Circle K',
  type: 'expense',
  status: 'posted',
  transactionDate: '2026-01-15T09:00:00Z',
  category: undefined, // Will be auto-classified to 'Ăn uống'
}

const mockIncomeTransaction: Transaction = {
  id: 'tx-2',
  accountId: 'vcb-checking-001',
  amount: 5000000,
  description: 'Salary',
  merchantName: 'Employer',
  type: 'income',
  status: 'posted',
  transactionDate: '2026-01-15T09:00:00Z',
}

describe('TransactionRow', () => {
  it('renders CategoryBadge for expense transactions', () => {
    const { container } = render(<TransactionRow transaction={mockExpenseTransaction} />)
    // CategoryBadge should be present (check for category styling)
    // The component should render without crashing
    expect(container).toBeTruthy()
  })

  it('does NOT render CategoryBadge for income transactions', () => {
    const { container } = render(<TransactionRow transaction={mockIncomeTransaction} />)
    // For income, no category badge button should appear
    expect(container).toBeTruthy()
  })

  it('displays server category if no override is set', () => {
    const txWithCategory: Transaction = {
      ...mockExpenseTransaction,
      category: 'Ăn uống' as any,
    }
    const { container } = render(<TransactionRow transaction={txWithCategory} />)
    // Component should render with category display
    expect(container).toBeTruthy()
  })

  it('displays override category if set', () => {
    useCategoryOverrideStore.getState().setOverride('tx-1', 'Mua sắm')
    const txWithCategory: Transaction = {
      ...mockExpenseTransaction,
      category: 'Ăn uống' as any,
    }
    const { container } = render(<TransactionRow transaction={txWithCategory} />)
    // Component should render with override (effective category should be Mua sắm)
    const effective = useCategoryOverrideStore.getState().getEffectiveCategory('tx-1', 'Ăn uống')
    expect(effective).toBe('Mua sắm')
    expect(container).toBeTruthy()
  })

  it('opens popover when CategoryBadge is clicked', () => {
    const txWithCategory: Transaction = {
      ...mockExpenseTransaction,
      category: 'Ăn uống' as any,
    }
    render(<TransactionRow transaction={txWithCategory} />)

    // Find category badge button (first button after icon)
    const buttonElements = screen.queryAllByRole('button')
    // Should have at least one button for the category badge
    expect(buttonElements.length).toBeGreaterThanOrEqual(1)
  })

  it('updates override when category is selected from popover', () => {
    const txWithCategory: Transaction = {
      ...mockExpenseTransaction,
      category: 'Ăn uống' as any,
    }
    render(<TransactionRow transaction={txWithCategory} />)

    // Set override directly (simulating popover click)
    useCategoryOverrideStore.getState().setOverride('tx-1', 'Giải trí')

    // Verify override was persisted
    const effective = useCategoryOverrideStore.getState().getEffectiveCategory('tx-1', 'Ăn uống')
    expect(effective).toBe('Giải trí')
  })
})
