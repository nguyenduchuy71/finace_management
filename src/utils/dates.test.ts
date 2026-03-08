import { describe, it, expect } from 'vitest'
import { calculateMonthDelta, getPreviousMonthDateRange } from './dates'

describe('calculateMonthDelta', () => {
  it('calculates positive delta: 100 → 150 returns 50%', () => {
    const delta = calculateMonthDelta(150, 100)
    expect(delta).toBe(50)
  })

  it('calculates negative delta: 100 → 50 returns -50%', () => {
    const delta = calculateMonthDelta(50, 100)
    expect(delta).toBe(-50)
  })

  it('returns null when previousAmount is 0', () => {
    const delta = calculateMonthDelta(100, 0)
    expect(delta).toBeNull()
  })

  it('returns null when previousAmount is negative', () => {
    const delta = calculateMonthDelta(100, -50)
    expect(delta).toBeNull()
  })

  it('rounds percentage to whole number: 100 → 133 returns 33%', () => {
    const delta = calculateMonthDelta(133, 100)
    expect(delta).toBe(33)
  })

  it('rounds down: 100 → 132 returns 32%', () => {
    const delta = calculateMonthDelta(132, 100)
    expect(delta).toBe(32)
  })
})

describe('getPreviousMonthDateRange', () => {
  it('Jan 15 → Dec 1–31 of previous year', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2026-01-15', null)
    expect(prevFrom).toBe('2025-12-01')
    expect(prevTo).toBe('2025-12-31')
  })

  it('Dec 15 → Nov 1–30 of same year', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2026-12-15', null)
    expect(prevFrom).toBe('2026-11-01')
    expect(prevTo).toBe('2026-11-30')
  })

  it('Feb 15 → Jan 1–31', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2026-02-15', null)
    expect(prevFrom).toBe('2026-01-01')
    expect(prevTo).toBe('2026-01-31')
  })

  it('March 15 → Feb 1–28 (non-leap year)', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2026-03-15', null)
    expect(prevFrom).toBe('2026-02-01')
    expect(prevTo).toBe('2026-02-28')
  })

  it('March 15 → Feb 1–29 (leap year)', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2024-03-15', null)
    expect(prevFrom).toBe('2024-02-01')
    expect(prevTo).toBe('2024-02-29')
  })

  it('handles month-end transition: May 31 → Apr 1–30', () => {
    const { prevFrom, prevTo } = getPreviousMonthDateRange('2026-05-31', null)
    expect(prevFrom).toBe('2026-04-01')
    expect(prevTo).toBe('2026-04-30')
  })
})
