import { describe, it, expect } from 'vitest'
import {
  computeCurrentCycle,
  groupTransactionsByCycle,
  formatCycleDateRange,
} from './billingCycle'
import type { CreditCardTransaction } from '@/types/creditCard'

describe('computeCurrentCycle', () => {
  it('today before statementDay → returns prev-month cycle', () => {
    // Mar 3 VN, statementDay=15 → cycle is 16/02/2026–15/03/2026
    const result = computeCurrentCycle(15, '2026-03-03T00:00:00Z')
    expect(result.startDisplay).toBe('16/02/2026')
    expect(result.endDisplay).toBe('15/03/2026')
    expect(result.daysUntilClose).toBeGreaterThan(0)
  })

  it('today after statementDay → returns current-month cycle', () => {
    // Mar 20 VN, statementDay=15 → cycle is 16/03/2026–15/04/2026
    const result = computeCurrentCycle(15, '2026-03-20T00:00:00Z')
    expect(result.startDisplay).toBe('16/03/2026')
    expect(result.endDisplay).toBe('15/04/2026')
  })

  it('December-to-January rollover (today Dec 20) → endDisplay crosses into next year', () => {
    // Dec 20 VN, statementDay=15 → cycle is 16/12/2026–15/01/2027
    const result = computeCurrentCycle(15, '2026-12-20T00:00:00Z')
    expect(result.endDisplay).toBe('15/01/2027')
  })

  it('January backward rollover (today Jan 5) → startDisplay rolls back to December', () => {
    // Jan 5 VN, statementDay=15 → cycle is 16/12/2025–15/01/2026
    const result = computeCurrentCycle(15, '2026-01-05T00:00:00Z')
    expect(result.startDisplay).toBe('16/12/2025')
    expect(result.endDisplay).toBe('15/01/2026')
  })

  it('today exactly on statementDay at 16:00 VN (before UTC midnight boundary) → still in previous cycle', () => {
    // 2026-03-15T09:00:00Z = 16:00 VN, statementDay=15
    // The boundary is 17:00 UTC (midnight VN next day), so 16:00 VN is still in the old cycle
    // vnDay = 15, so vnDay <= statementDay → previous cycle applies
    const result = computeCurrentCycle(15, '2026-03-15T09:00:00Z')
    expect(result.startDisplay).toBe('16/02/2026')
    expect(result.endDisplay).toBe('15/03/2026')
  })
})

describe('groupTransactionsByCycle', () => {
  it('pending transaction (no billingCycleStart) → assigned to currentCycle group', () => {
    const currentCycle = computeCurrentCycle(15, '2026-03-03T00:00:00Z')

    const pendingTx: CreditCardTransaction = {
      id: 'p1',
      cardId: 'tcb-visa-001',
      amount: -280_000,
      description: 'Grab Food - Test',
      merchantName: 'Grab',
      type: 'purchase',
      status: 'pending',
      transactionDate: '2026-03-01T11:00:00Z',
      // billingCycleStart and billingCycleEnd intentionally omitted (pending)
    }

    const groups = groupTransactionsByCycle([pendingTx], currentCycle)

    expect(groups.length).toBe(1)
    expect(groups[0].isCurrentCycle).toBe(true)
    expect(groups[0].transactions[0].id).toBe('p1')
  })

  it('posted transaction → grouped under its billingCycleStart key', () => {
    const currentCycle = computeCurrentCycle(15, '2026-03-03T00:00:00Z')

    const postedTx: CreditCardTransaction = {
      id: 'q1',
      cardId: 'tcb-visa-001',
      amount: -350_000,
      description: 'AEON Mall - Test',
      merchantName: 'AEON Mall',
      type: 'purchase',
      status: 'posted',
      transactionDate: '2026-01-28T05:00:00Z',
      postedDate: '2026-01-29T01:00:00Z',
      billingCycleStart: '2026-01-15T17:00:00Z',
      billingCycleEnd: '2026-02-15T17:00:00Z',
    }

    const groups = groupTransactionsByCycle([postedTx], currentCycle)

    expect(groups[0].cycleKey).toBe('2026-01-15T17:00:00Z')
    expect(groups[0].isCurrentCycle).toBe(false)
  })
})

describe('formatCycleDateRange', () => {
  it('returns startDisplay and endDisplay as VN-local inclusive dates', () => {
    // '2026-02-15T17:00:00Z' = 16 Feb 2026 00:00 VN (cycle start)
    // '2026-03-15T17:00:00Z' = 16 Mar 2026 00:00 VN (exclusive end boundary)
    //   → inclusive last day = 15 Mar 2026
    const result = formatCycleDateRange(
      '2026-02-15T17:00:00Z',
      '2026-03-15T17:00:00Z'
    )
    expect(result.startDisplay).toBe('16/02/2026')
    expect(result.endDisplay).toBe('15/03/2026')
  })
})
