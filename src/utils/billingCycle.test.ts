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

describe('computeCurrentCycle — ngày sao kê 29-31 và tháng ngắn', () => {
  // Trước khi kẹp ngày: Date.UTC(2026, 3, 31) tràn sang 1/5 nên chu kỳ sai / không chứa "bây giờ".
  it('ngày sao kê 31 trong tháng 4 (30 ngày): chu kỳ kết thúc 30/04, không tràn sang 01/05', () => {
    const c = computeCurrentCycle(31, '2026-04-15T05:00:00Z')
    expect(c.startDisplay).toBe('01/04/2026')
    expect(c.endDisplay).toBe('30/04/2026')
  })

  it('ngày 1/5 với ngày sao kê 31: chu kỳ mới bắt đầu 01/05 và chứa ngày hiện tại', () => {
    const now = '2026-05-01T05:00:00Z'
    const c = computeCurrentCycle(31, now)
    expect(c.startDisplay).toBe('01/05/2026')
    expect(c.endDisplay).toBe('31/05/2026')
    expect(new Date(c.startISO).getTime()).toBeLessThanOrEqual(new Date(now).getTime())
    expect(new Date(now).getTime()).toBeLessThan(new Date(c.endISO).getTime())
  })

  it('ngày sao kê 30 trong tháng 2: cắt vào ngày cuối tháng 2 (28/2/2026, 29/2/2028)', () => {
    expect(computeCurrentCycle(30, '2026-02-10T05:00:00Z').endDisplay).toBe('28/02/2026')
    expect(computeCurrentCycle(30, '2028-02-10T05:00:00Z').endDisplay).toBe('29/02/2028')
  })

  it('ngày cuối tháng ngắn vẫn thuộc chu kỳ đang chạy, ngày sau sang chu kỳ mới', () => {
    const last = computeCurrentCycle(31, '2026-04-30T16:59:00Z') // 23:59 VN ngày 30/4
    expect(last.endDisplay).toBe('30/04/2026')
    const next = computeCurrentCycle(31, '2026-04-30T17:00:00Z') // đúng 00:00 VN ngày 1/5
    expect(next.startDisplay).toBe('01/05/2026')
  })

  // Tính chất: với MỌI ngày trong 3 năm và MỌI ngày sao kê 1..31, chu kỳ phải chứa "bây giờ",
  // kết thúc ở ngày sao kê đã kẹp theo độ dài tháng, và dài 28..31 ngày.
  // Gom vi phạm vào mảng rồi kiểm MỘT lần: ~34 nghìn tổ hợp × nhiều expect() từng mất ~4s
  // (sát timeout 5s, fail khi cả bộ test chạy song song).
  it('mọi ngày × mọi ngày sao kê 1..31 (2026-2028): chu kỳ chứa now và kết thúc đúng ngày kẹp', () => {
    const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const violations: string[] = []
    for (let t = Date.UTC(2026, 0, 1, 5); t < Date.UTC(2029, 0, 1); t += 86_400_000) {
      const now = new Date(t).toISOString()
      for (let day = 1; day <= 31; day++) {
        const c = computeCurrentCycle(day, now)
        const start = new Date(c.startISO)
        const end = new Date(c.endISO)
        const problems: string[] = []
        if (!(start.getTime() <= t && t < end.getTime())) problems.push('không chứa now')
        if (end.getUTCDate() !== Math.min(day, daysInMonth(end.getUTCFullYear(), end.getUTCMonth()))) problems.push('ngày kết thúc sai')
        if (start.getUTCDate() !== Math.min(day, daysInMonth(start.getUTCFullYear(), start.getUTCMonth()))) problems.push('ngày bắt đầu sai')
        if (end.getUTCHours() !== 17 || start.getUTCHours() !== 17) problems.push('không cắt 17:00 UTC')
        const lengthDays = (end.getTime() - start.getTime()) / 86_400_000
        if (lengthDays < 28 || lengthDays > 31) problems.push(`dài ${lengthDays} ngày`)
        if (problems.length) violations.push(`now=${now} day=${day}: ${problems.join(', ')}`)
      }
    }
    expect(violations.slice(0, 5)).toEqual([])
    expect(violations).toHaveLength(0)
    // Cố ý quét đủ ~34 nghìn tổ hợp (~1,5s khi chạy riêng): timeout riêng vì tải song song làm chậm gấp nhiều lần.
  }, 30_000)
})

describe('groupTransactionsByCycle', () => {
  const tx = (id: string, transactionDate: string): CreditCardTransaction => ({
    id, cardId: 'c', amount: -1, description: 'x', merchantName: 'x', type: 'purchase', status: 'posted', transactionDate,
  })

  it('giao dịch không có ranh giới chu kỳ vào chu kỳ CHỨA ngày giao dịch, không dồn vào kỳ hiện tại', () => {
    // Sao kê ngày 15, hôm nay 20/10 (VN) -> kỳ hiện tại 16/10..15/11
    const current = computeCurrentCycle(15, '2026-10-20T03:00:00Z')
    const groups = groupTransactionsByCycle([
      tx('now', '2026-10-18T03:00:00Z'),
      tx('sep', '2026-09-04T03:00:00Z'), // kỳ 16/08..15/09
      tx('oct-early', '2026-10-02T03:00:00Z'), // kỳ 16/09..15/10
    ], current, 15)
    expect(groups.map((g) => [g.isCurrentCycle, g.transactions.map((t) => t.id)])).toEqual([
      [true, ['now']],
      [false, ['oct-early']],
      [false, ['sep']],
    ])
    expect(formatCycleDateRange(groups[2].cycleStartISO, groups[2].cycleEndISO))
      .toEqual({ startDisplay: '16/08/2026', endDisplay: '15/09/2026' })
  })

  it('ranh giới theo giờ VN: 23:30 ngày sao kê (VN) thuộc kỳ cũ, 00:00 hôm sau thuộc kỳ mới', () => {
    const current = computeCurrentCycle(15, '2026-10-20T03:00:00Z')
    const groups = groupTransactionsByCycle([
      tx('last-minute', '2026-10-15T16:30:00Z'), // 23:30 15/10 VN
      tx('first-minute', '2026-10-15T17:00:00Z'), // 00:00 16/10 VN
    ], current, 15)
    expect(groups.map((g) => [g.isCurrentCycle, g.transactions[0].id])).toEqual([
      [true, 'first-minute'],
      [false, 'last-minute'],
    ])
  })

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

    const groups = groupTransactionsByCycle([pendingTx], currentCycle, 15)

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

    const groups = groupTransactionsByCycle([postedTx], currentCycle, 15)

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
