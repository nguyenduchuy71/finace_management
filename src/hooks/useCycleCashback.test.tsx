import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/cashbackRules', () => ({
  listCashbackRules: vi.fn(),
  getCycleExpenses: vi.fn(),
  createCashbackRule: vi.fn(),
  updateCashbackRule: vi.fn(),
  deleteCashbackRule: vi.fn(),
  setCardCashbackCap: vi.fn(),
}))

import { listCashbackRules, getCycleExpenses } from '@/services/cashbackRules'
import { useCycleCashback } from './useCycleCashback'
import type { CreditCardTransaction } from '@/types/creditCard'

const cycle = { startISO: '2026-03-01T00:00:00.000Z', endISO: '2026-04-01T00:00:00.000Z' }
const tx = (amount: number): CreditCardTransaction => ({
  id: `t${amount}`, cardId: 'c1', amount, description: 'x', merchantName: 'x',
  type: 'purchase', status: 'posted', transactionDate: '2026-03-08T10:00:00Z',
})

function render(cap: number | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return renderHook(({ c }) => useCycleCashback('c1', cycle, c), { wrapper, initialProps: { c: cap } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCashbackRules).mockResolvedValue([
    {
      id: 'r1', cardId: 'c1', mcc: null, ratePercent: 0.5, minCycleSpend: 5_000_000, capPerCycle: null,
      tiers: [{ minSpend: 10_000_000, ratePercent: 1 }],
    },
  ])
  vi.mocked(getCycleExpenses).mockResolvedValue([tx(-10_000_000)])
})

describe('useCycleCashback', () => {
  it('tính theo bậc thang của rule', async () => {
    const { result } = render(null)
    await waitFor(() => expect(result.current.result).not.toBeNull())
    expect(result.current.result).toMatchObject({ total: 100_000, cardCapped: false })
    expect(result.current.result?.byRule[0]).toMatchObject({ tierIndex: 1, appliedRatePercent: 1 })
  })

  it('áp trần thẻ truyền vào', async () => {
    const { result } = render(80_000)
    await waitFor(() => expect(result.current.result).not.toBeNull())
    expect(result.current.result).toMatchObject({ total: 80_000, uncappedTotal: 100_000, cardCapped: true })
  })

  it('đổi trần thẻ tính lại ngay, không gọi lại service giao dịch', async () => {
    const { result, rerender } = render(null)
    await waitFor(() => expect(result.current.result).not.toBeNull())
    expect(result.current.result?.total).toBe(100_000)

    rerender({ c: 50_000 })
    expect(result.current.result).toMatchObject({ total: 50_000, cardCapped: true })
    rerender({ c: null })
    expect(result.current.result?.total).toBe(100_000)
    expect(getCycleExpenses).toHaveBeenCalledTimes(1)
  })
})
