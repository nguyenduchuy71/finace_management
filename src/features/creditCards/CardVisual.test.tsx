import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardVisual } from './CardVisual'
import { CycleProgress } from './CycleProgress'
import type { CreditCard } from '@/types/creditCard'
import type { BillingCycle } from '@/utils/billingCycle'

const card: CreditCard = {
  id: 'c1', bankName: 'VPBank', cardName: 'VPBank StepUp', cardNumber: '****1234', cardType: 'mastercard',
  currency: 'VND', creditLimit: 50_000_000, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  cashbackMonthlyCap: null, lastUpdated: '2026-01-01T00:00:00Z',
}

describe('CardVisual', () => {
  it('mô tả thẻ cho trình đọc màn hình chỉ với 4 số cuối', () => {
    render(<CardVisual card={card} />)
    const img = screen.getByRole('img', { name: 'Thẻ VPBank StepUp, VPBank, đuôi 1234' })
    expect(img.className).toContain('from-emerald-700')
    expect(img).not.toHaveTextContent('****')
  })

  it('hiện hạn mức và loại thẻ; ẩn hạn mức khi = 0', () => {
    const { rerender } = render(<CardVisual card={card} />)
    expect(screen.getByText('Hạn mức đ 50.000.000')).toBeInTheDocument()
    expect(screen.getByText('Mastercard')).toBeInTheDocument()
    rerender(<CardVisual card={{ ...card, creditLimit: 0 }} />)
    expect(screen.queryByText(/Hạn mức/)).not.toBeInTheDocument()
  })
})

const cycle = (daysUntilClose: number): BillingCycle => ({
  startISO: '2026-10-09T17:00:00.000Z', endISO: '2026-11-09T17:00:00.000Z',
  startDisplay: '10/10/2026', endDisplay: '09/11/2026', statementDateDisplay: '09/11/2026', daysUntilClose,
})

describe('CycleProgress', () => {
  it('thanh tiến độ theo thời gian đã qua + số ngày còn lại bằng chữ', () => {
    render(<CycleProgress cycle={cycle(21)} nowISO="2026-10-19T17:00:00.000Z" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '32')
    expect(screen.getByText('Còn 21 ngày')).toBeInTheDocument()
    expect(screen.getByText('10/10/2026')).toBeInTheDocument()
    expect(screen.getByText('09/11/2026')).toBeInTheDocument()
  })

  it('≤ 3 ngày: màu gấp (expense) cho cả chip và thanh', () => {
    render(<CycleProgress cycle={cycle(2)} nowISO="2026-11-07T17:00:00.000Z" />)
    expect(screen.getByText('Còn 2 ngày').className).toContain('text-expense')
    expect(screen.getByRole('progressbar').firstElementChild?.className).toContain('bg-expense')
  })
})
