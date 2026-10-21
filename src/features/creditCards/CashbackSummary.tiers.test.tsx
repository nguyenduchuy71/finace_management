import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/cashbackRules', () => ({
  listCashbackRules: vi.fn(),
  createCashbackRule: vi.fn(),
  updateCashbackRule: vi.fn(),
  deleteCashbackRule: vi.fn(),
  getCycleExpenses: vi.fn(),
  setCardCashbackCap: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { listCashbackRules, getCycleExpenses } from '@/services/cashbackRules'
import { CashbackSummary } from './CashbackSummary'
import type { CashbackRule } from '@/types/cashback'
import type { CreditCard, CreditCardTransaction } from '@/types/creditCard'

const card: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265', cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  cashbackMonthlyCap: null,
  lastUpdated: '2026-01-01T00:00:00Z',
}
const cycle = { startISO: '2026-03-09T17:00:00.000Z', endISO: '2026-04-09T17:00:00.000Z' }
const rule = (over: Partial<CashbackRule>): CashbackRule => ({
  id: 'r1', cardId: 'card-1', mcc: null, ratePercent: 0.5, minCycleSpend: 5_000_000, capPerCycle: null,
  tiers: [{ minSpend: 10_000_000, ratePercent: 1 }], ...over,
})
const tx = (amount: number, mcc?: string): CreditCardTransaction => ({
  id: `t${Math.random()}`, cardId: 'card-1', amount, description: 'x', merchantName: 'x',
  type: 'purchase', status: 'posted', transactionDate: '2026-03-20T10:00:00Z', mcc,
})

function renderSummary(c: CreditCard = card) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(<CashbackSummary card={c} cycle={cycle} />, { wrapper })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listCashbackRules).mockResolvedValue([])
  vi.mocked(getCycleExpenses).mockResolvedValue([])
})

describe('CashbackSummary — bậc thang và trần thẻ', () => {
  it('hiện % của bậc đang áp, không phải % bậc nền', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-10_000_000)])
    renderSummary()
    expect(await screen.findByText(/chi .*10\.000\.000.* · 1%/)).toBeInTheDocument()
    expect(screen.getByTestId('cashback-total')).toHaveTextContent('100.000')
  })

  it('gợi ý còn bao nhiêu để lên bậc kế', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-6_000_000)])
    renderSummary()
    expect(await screen.findByText(/Còn .*4\.000\.000.* nữa để lên bậc 1%/)).toBeInTheDocument()
  })

  it('ở bậc cao nhất thì không còn gợi ý lên bậc', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-12_000_000)])
    renderSummary()
    await screen.findByTestId('cashback-total')
    expect(screen.queryByText(/nữa để lên bậc/)).not.toBeInTheDocument()
  })

  it('chưa đạt ngưỡng nền: báo chưa đạt, không gợi ý "lên bậc" và hiện % bậc nền', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-1_000_000)])
    renderSummary()
    expect(await screen.findByText(/Chưa đạt ngưỡng/)).toBeInTheDocument()
    expect(screen.getByText(/chi .*1\.000\.000.* · 0\.5%/)).toBeInTheDocument()
    expect(screen.queryByText(/nữa để lên bậc/)).not.toBeInTheDocument()
  })

  it('tổng vượt trần thẻ: hiện tổng đã cắt, huy hiệu và số trước khi cắt', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-10_000_000)])
    renderSummary({ ...card, cashbackMonthlyCap: 80_000 })
    expect(await screen.findByText('Đã chạm trần thẻ')).toBeInTheDocument()
    expect(screen.getByTestId('cashback-total')).toHaveTextContent('80.000')
    expect(screen.getByText(/trước khi cắt: .*100\.000/)).toBeInTheDocument()
  })

  it('có trần thẻ nhưng chưa chạm: không hiện huy hiệu', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-10_000_000)])
    renderSummary({ ...card, cashbackMonthlyCap: 100_000 })
    await screen.findByTestId('cashback-total')
    expect(screen.queryByText('Đã chạm trần thẻ')).not.toBeInTheDocument()
    expect(screen.getByTestId('cashback-total')).toHaveTextContent('100.000')
  })
})

describe('CashbackSummary — thước tiến độ', () => {
  it('rule chưa ở bậc cao nhất: thanh tiến tới bậc kế = chi / ngưỡng bậc kế', async () => {
    // Bậc nền 5tr đạt, bậc 1 cần 10tr: chi 6tr -> 60%
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-6_000_000)])
    renderSummary()
    const bar = await screen.findByRole('progressbar', { name: 'Tiến tới bậc 1%' })
    expect(bar).toHaveAttribute('aria-valuenow', '60')
  })

  it('rule ở bậc cao nhất có trần: thanh là mức đã dùng của trần rule', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ tiers: [], minCycleSpend: 0, ratePercent: 1, capPerCycle: 40_000 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-2_000_000)]) // 1% = 20.000 / 40.000
    renderSummary()
    const bar = await screen.findByRole('progressbar', { name: 'Đã dùng trần của rule' })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('thẻ có trần: thanh tổng hoàn / trần thẻ, kẹp 100 khi chạm trần', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ tiers: [], minCycleSpend: 0, ratePercent: 1 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-30_000_000)]) // 300.000 > trần 200.000
    renderSummary({ ...card, cashbackMonthlyCap: 200_000 })
    const bar = await screen.findByRole('progressbar', { name: 'Đã dùng trần hoàn tiền của thẻ' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText(/trần thẻ đ 200\.000/)).toBeInTheDocument()
  })

  it('thẻ không có trần: không có thanh trần thẻ', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({})])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-6_000_000)])
    renderSummary()
    await screen.findByTestId('cashback-total')
    expect(screen.queryByRole('progressbar', { name: 'Đã dùng trần hoàn tiền của thẻ' })).not.toBeInTheDocument()
  })
})
