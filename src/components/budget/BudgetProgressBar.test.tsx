import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetProgressBar } from './BudgetProgressBar'

describe('BudgetProgressBar Component', () => {
  it('BudgetProgressBar with spent=0, budget=1000 renders 0% with emerald fill color', () => {
    render(<BudgetProgressBar category="Ăn uống" spent={0} budget={1000} />)

    // Should render the category name
    const categoryText = screen.getByText('Ăn uống')
    expect(categoryText).toBeTruthy()

    // Should show 0%
    const percentText = screen.getByText('0%')
    expect(percentText).toBeTruthy()

    // Should have emerald color class
    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-emerald')
  })

  it('BudgetProgressBar with spent=500, budget=1000 renders 50% with emerald fill', () => {
    render(<BudgetProgressBar category="Mua sắm" spent={500} budget={1000} />)

    const percentText = screen.getByText('50%')
    expect(percentText).toBeTruthy()

    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-emerald')
  })

  it('BudgetProgressBar with spent=800, budget=1000 renders 80% with yellow fill (warning state)', () => {
    render(<BudgetProgressBar category="Di chuyển" spent={800} budget={1000} />)

    const percentText = screen.getByText('80%')
    expect(percentText).toBeTruthy()

    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-yellow')
  })

  it('BudgetProgressBar with spent=900, budget=1000 renders 90% with yellow fill', () => {
    render(<BudgetProgressBar category="Giải trí" spent={900} budget={1000} />)

    const percentText = screen.getByText('90%')
    expect(percentText).toBeTruthy()

    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-yellow')
  })

  it('BudgetProgressBar with spent=1000, budget=1000 renders 100% with red fill (overbudget)', () => {
    render(<BudgetProgressBar category="Hóa đơn" spent={1000} budget={1000} />)

    const percentText = screen.getByText('100%')
    expect(percentText).toBeTruthy()

    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-red')
  })

  it('BudgetProgressBar with spent=1200, budget=1000 renders 100% (capped) with red fill, but label shows "120%"', () => {
    render(<BudgetProgressBar category="Khác" spent={1200} budget={1000} />)

    // Percentage label should show actual percentage (120%)
    const percentText = screen.getByText('120%')
    expect(percentText).toBeTruthy()

    // Visual fill should be capped at 100%
    const fillBar = document.querySelector('[data-testid="budget-fill"]')
    expect(fillBar?.className).toContain('bg-red')

    // Check the fill width is capped
    const fillWidth = fillBar?.getAttribute('style')
    expect(fillWidth).toContain('100%')
  })

  it('BudgetProgressBar with budget=0 returns null (doesn\'t render)', () => {
    const { container } = render(<BudgetProgressBar category="Ăn uống" spent={100} budget={0} />)

    // Should not render anything
    expect(container.firstChild).toBeNull()
  })

  it('Component displays category name, percentage, and spent/budget amounts in formatVND() format', () => {
    render(<BudgetProgressBar category="Ăn uống" spent={500000} budget={1000000} />)

    // Should display category name
    expect(screen.getByText('Ăn uống')).toBeTruthy()

    // Should display percentage
    expect(screen.getByText('50%')).toBeTruthy()

    // Should display spent amount in currency format
    const spentText = screen.getByText(/đ 500\.000/)
    expect(spentText).toBeTruthy()

    // Should display budget amount in currency format
    const budgetText = screen.getByText(/đ 1\.000\.000/)
    expect(budgetText).toBeTruthy()
  })
})
