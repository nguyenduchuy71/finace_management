import { describe, it, expect } from 'vitest'
import { cycleProgressPercent, cycleUrgency } from './cycle-progress'

const START = '2026-10-09T17:00:00.000Z'
const END = '2026-11-09T17:00:00.000Z' // 31 ngày

describe('cycleProgressPercent', () => {
  it('đầu kỳ 0, cuối kỳ 100', () => {
    expect(cycleProgressPercent(START, END, START)).toBe(0)
    expect(cycleProgressPercent(START, END, END)).toBe(100)
  })

  it('giữa kỳ theo tỉ lệ thời gian, làm tròn', () => {
    // 10 ngày / 31 ngày = 32,26%
    expect(cycleProgressPercent(START, END, '2026-10-19T17:00:00.000Z')).toBe(32)
  })

  it('now ngoài chu kỳ bị kẹp vào 0..100', () => {
    expect(cycleProgressPercent(START, END, '2026-10-01T00:00:00.000Z')).toBe(0)
    expect(cycleProgressPercent(START, END, '2026-12-01T00:00:00.000Z')).toBe(100)
  })

  it('chu kỳ hỏng (end <= start) trả 0 thay vì NaN/Infinity', () => {
    expect(cycleProgressPercent(END, START, START)).toBe(0)
    expect(cycleProgressPercent(START, START, START)).toBe(0)
  })
})

describe('cycleUrgency', () => {
  it.each([
    [0, 'urgent'], [3, 'urgent'], [4, 'soon'], [7, 'soon'], [8, 'calm'], [30, 'calm'],
  ] as const)('%i ngày -> %s', (days, expected) => {
    expect(cycleUrgency(days)).toBe(expected)
  })
})
