import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetProgressSection } from './BudgetProgressSection'
import type { Category } from '@/types/categories'

// Mock budgetStore
const mockBudgets: Record<string, number> = {}
vi.mock('@/stores/budgetStore', () => ({
  useBudgetStore: vi.fn(() => ({ budgets: mockBudgets })),
}))

// Mock useBudgetAlerts
const mockAlerts = {
  alerts: [] as Array<{ category: string; percent: number; level: string }>,
  warningCount: 0,
  overbudgetCount: 0,
}
vi.mock('@/hooks/useBudgetAlerts', () => ({
  useBudgetAlerts: vi.fn(() => mockAlerts),
}))

// Mock BudgetSettings to detect open state
vi.mock('@/components/budget/BudgetSettings', () => ({
  BudgetSettings: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="budget-settings-dialog">Settings Dialog</div> : null,
}))

// Mock BudgetProgressBar
vi.mock('@/components/budget/BudgetProgressBar', () => ({
  BudgetProgressBar: ({ category }: { category: string }) => (
    <div data-testid={`progress-${category}`}>{category}</div>
  ),
}))

describe('BudgetProgressSection', () => {
  beforeEach(() => {
    // Reset mock budgets to have at least one budget so section renders
    Object.keys(mockBudgets).forEach((k) => delete mockBudgets[k])
    Object.assign(mockBudgets, { 'Ăn uống': 1000000 } as Record<Category, number>)

    // Reset alerts
    mockAlerts.alerts = []
    mockAlerts.warningCount = 0
    mockAlerts.overbudgetCount = 0
  })

  // Test 1: renders settings gear icon button
  it('renders a settings gear icon button in the card header', () => {
    render(
      <BudgetProgressSection categoryBreakdown={[{ category: 'Ăn uống', amount: 500000 }]} />
    )

    const settingsButton = screen.getByRole('button', { name: /cài đặt ngân sách/i })
    expect(settingsButton).toBeTruthy()
  })

  // Test 2: clicking settings button opens BudgetSettings dialog
  it('opens BudgetSettings dialog when settings button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <BudgetProgressSection categoryBreakdown={[{ category: 'Ăn uống', amount: 500000 }]} />
    )

    expect(screen.queryByTestId('budget-settings-dialog')).toBeFalsy()

    const settingsButton = screen.getByRole('button', { name: /cài đặt ngân sách/i })
    await user.click(settingsButton)

    expect(screen.getByTestId('budget-settings-dialog')).toBeTruthy()
  })

  // Test 3: badge shows alert count when alerts exist
  it('shows alert count badge when useBudgetAlerts returns alerts', () => {
    mockAlerts.alerts = [
      { category: 'Ăn uống', percent: 90, level: 'warning' },
      { category: 'Mua sắm', percent: 120, level: 'overbudget' },
    ]
    mockAlerts.warningCount = 1
    mockAlerts.overbudgetCount = 1

    render(
      <BudgetProgressSection categoryBreakdown={[{ category: 'Ăn uống', amount: 900000 }]} />
    )

    expect(screen.getByText('2')).toBeTruthy()
  })

  // Test 4: badge hidden when no alerts
  it('hides badge when no alerts exist', () => {
    mockAlerts.alerts = []
    mockAlerts.warningCount = 0
    mockAlerts.overbudgetCount = 0

    render(
      <BudgetProgressSection categoryBreakdown={[{ category: 'Ăn uống', amount: 500000 }]} />
    )

    expect(screen.queryByTestId('alert-badge')).toBeFalsy()
  })

  // Test 5: badge uses destructive variant when overbudget exists, warning style when only warnings
  it('uses destructive badge variant when overbudget alerts exist', () => {
    mockAlerts.alerts = [
      { category: 'Ăn uống', percent: 120, level: 'overbudget' },
    ]
    mockAlerts.warningCount = 0
    mockAlerts.overbudgetCount = 1

    render(
      <BudgetProgressSection categoryBreakdown={[{ category: 'Ăn uống', amount: 1200000 }]} />
    )

    const badge = screen.getByTestId('alert-badge')
    expect(badge.getAttribute('data-variant')).toBe('destructive')
  })
})
