import { describe, it, expect } from 'vitest'
import { formatDisplayDate } from './dates'

describe('formatDisplayDate', () => {
  it('converts UTC midnight to Vietnam date (UTC+7 is next day)', () => {
    // 2026-01-14 17:00 UTC = 2026-01-15 00:00 UTC+7
    expect(formatDisplayDate('2026-01-14T17:00:00Z')).toBe('15/01/2026')
  })
  it('formats a daytime UTC date correctly in UTC+7', () => {
    // 2026-01-15 05:00 UTC = 2026-01-15 12:00 UTC+7 — same day
    expect(formatDisplayDate('2026-01-15T05:00:00Z')).toBe('15/01/2026')
  })
})
