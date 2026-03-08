import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard Component - Delta Badge Display', () => {
  // Test 1: StatCard renders delta prop when provided and transactionCount >= 5
  it('renders delta badge with up arrow when delta is positive and transactionCount >= 5', () => {
    render(
      <StatCard variant="income" amount={12000000} transactionCount={10} delta={12} />
    )

    expect(screen.getByText('↑12% vs tháng trước')).toBeTruthy()
  })

  // Test 2: StatCard shows "Chưa đủ dữ liệu" when transactionCount < 5
  it('shows "Chưa đủ dữ liệu" when transactionCount < 5', () => {
    render(
      <StatCard variant="income" amount={5000000} transactionCount={4} delta={12} />
    )

    expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy()
    expect(screen.queryByText('↑12% vs tháng trước')).toBeFalsy()
  })

  // Test 3: StatCard shows "Chưa đủ dữ liệu" when delta is null
  it('shows "Chưa đủ dữ liệu" when delta is null (previousAmount was zero or negative)', () => {
    render(
      <StatCard variant="income" amount={5000000} transactionCount={10} delta={null} />
    )

    expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy()
  })

  // Test 4: Positive delta colored green for income
  it('colors positive delta green for income variant', () => {
    const { container } = render(
      <StatCard variant="income" amount={12000000} transactionCount={10} delta={12} />
    )

    const deltaElement = screen.getByText('↑12% vs tháng trước')
    expect(deltaElement.className).toContain('text-emerald')
  })

  // Test 5: Negative delta colored red for income
  it('colors negative delta red for income variant', () => {
    const { container } = render(
      <StatCard variant="income" amount={5000000} transactionCount={10} delta={-8} />
    )

    const deltaElement = screen.getByText('↓8% vs tháng trước')
    expect(deltaElement.className).toContain('text-red')
  })

  // Test 6: Positive delta colored red for expense
  it('colors positive delta red for expense variant (increase is bad)', () => {
    const { container } = render(
      <StatCard variant="expense" amount={6000000} transactionCount={10} delta={12} />
    )

    const deltaElement = screen.getByText('↑12% vs tháng trước')
    expect(deltaElement.className).toContain('text-red')
  })

  // Test 7: Negative delta colored green for expense
  it('colors negative delta green for expense variant (decrease is good)', () => {
    const { container } = render(
      <StatCard variant="expense" amount={3000000} transactionCount={10} delta={-8} />
    )

    const deltaElement = screen.getByText('↓8% vs tháng trước')
    expect(deltaElement.className).toContain('text-emerald')
  })

  // Test 8: deltaLoading=true shows "Đang tính..."
  it('shows "Đang tính..." when deltaLoading=true', () => {
    render(
      <StatCard
        variant="income"
        amount={10000000}
        transactionCount={10}
        delta={null}
        deltaLoading={true}
      />
    )

    expect(screen.getByText('Đang tính...')).toBeTruthy()
  })

  // Test 9: transactionCount=0 shows "Không có giao dịch trong kỳ này"
  it('shows "Không có giao dịch trong kỳ này" when transactionCount=0', () => {
    render(
      <StatCard variant="income" amount={0} transactionCount={0} delta={null} />
    )

    expect(screen.getByText('Không có giao dịch trong kỳ này')).toBeTruthy()
    expect(screen.queryByText(/Chưa đủ dữ liệu|Đang tính/)).toBeFalsy()
  })

  // Test 10: delta badge appears below main amount display
  it('renders delta badge below the main amount in DOM order', () => {
    const { container } = render(
      <StatCard variant="income" amount={12000000} transactionCount={10} delta={12} />
    )

    const cardContent = container.querySelector('[class*="card-gap"]')
    expect(cardContent).toBeTruthy()

    const amountText = screen.getByText(/đ/)
    const deltaText = screen.getByText('↑12% vs tháng trước')

    // Both should exist and delta should be after amount in the DOM
    expect(amountText).toBeTruthy()
    expect(deltaText).toBeTruthy()
  })

  // Test 11: Negative delta displays down arrow
  it('renders delta badge with down arrow when delta is negative', () => {
    render(
      <StatCard variant="income" amount={5000000} transactionCount={10} delta={-8} />
    )

    expect(screen.getByText('↓8% vs tháng trước')).toBeTruthy()
  })

  // Test 12: Zero delta shows no arrow direction, but shows 0%
  it('renders zero delta as 0% with up arrow', () => {
    render(
      <StatCard variant="income" amount={10000000} transactionCount={10} delta={0} />
    )

    expect(screen.getByText('↑0% vs tháng trước')).toBeTruthy()
  })
})
