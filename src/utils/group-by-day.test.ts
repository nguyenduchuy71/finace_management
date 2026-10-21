import { describe, it, expect } from 'vitest'
import { formatDayLabel, groupByDay, vnDayKey } from './group-by-day'

const tx = (id: string, transactionDate: string, amount: number) => ({ id, transactionDate, amount })

describe('vnDayKey', () => {
  it('dùng ngày lịch VN (UTC+7), không phải ngày UTC', () => {
    expect(vnDayKey('2026-10-19T16:59:00Z')).toBe('2026-10-19') // 23:59 VN
    expect(vnDayKey('2026-10-19T17:00:00Z')).toBe('2026-10-20') // 00:00 VN hôm sau
  })
})

describe('groupByDay', () => {
  it('gộp theo ngày VN, giữ thứ tự đầu vào, tổng thu/chi riêng từng ngày', () => {
    const groups = groupByDay([
      tx('a', '2026-10-20T02:00:00Z', -50_000),
      tx('b', '2026-10-19T17:30:00Z', 1_000_000), // 00:30 20/10 VN -> cùng ngày với a
      tx('c', '2026-10-19T10:00:00Z', -20_000),
      tx('d', '2026-10-19T01:00:00Z', -30_000),
    ])
    expect(groups.map((g) => [g.dayKey, g.items.map((i) => i.id), g.income, g.expense])).toEqual([
      ['2026-10-20', ['a', 'b'], 1_000_000, 50_000],
      ['2026-10-19', ['c', 'd'], 0, 50_000],
    ])
  })

  it('chuyển nội bộ vẫn hiện trong nhóm nhưng không cộng vào tổng ngày (khớp dashboard)', () => {
    const [g] = groupByDay([
      { id: 'a', transactionDate: '2026-10-20T02:00:00Z', amount: -3_000_000, kind: 'internal_transfer' },
      { id: 'b', transactionDate: '2026-10-20T03:00:00Z', amount: -40_000, kind: 'normal' },
      { id: 'c', transactionDate: '2026-10-20T04:00:00Z', amount: 3_000_000, kind: 'internal_transfer' },
    ])
    expect(g.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect([g.income, g.expense]).toEqual([0, 40_000])
  })

  it('danh sách rỗng -> không nhóm nào', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('formatDayLabel', () => {
  const now = '2026-10-21T03:00:00Z' // 10:00 21/10 VN, thứ tư
  it('hôm nay / hôm qua theo ngày VN', () => {
    expect(formatDayLabel('2026-10-21', now)).toBe('Hôm nay')
    expect(formatDayLabel('2026-10-20', now)).toBe('Hôm qua')
  })

  it('ngày khác: thứ + ngày đầy đủ', () => {
    expect(formatDayLabel('2026-10-19', now)).toBe('Thứ hai, 19/10/2026')
    expect(formatDayLabel('2026-10-18', now)).toBe('Chủ nhật, 18/10/2026')
  })

  it('sát nửa đêm VN: "hôm qua" vẫn tính theo VN', () => {
    // 23:30 UTC 20/10 = 06:30 21/10 VN
    expect(formatDayLabel('2026-10-20', '2026-10-20T23:30:00Z')).toBe('Hôm qua')
  })
})
