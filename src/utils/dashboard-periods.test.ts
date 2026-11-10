import { describe, it, expect } from 'vitest'
import { formatPeriodRange, isWholeCalendarMonth, presetRange } from './dashboard-periods'

describe('presetRange — theo lịch Việt Nam', () => {
  // 17:30 UTC 31/12/2026 = 00:30 01/01/2027 ở VN
  const NOW = '2026-12-31T17:30:00Z'

  it('Tháng này / Tháng trước / 3 tháng / Tất cả', () => {
    expect(presetRange('this_month', NOW)).toEqual({ dateFrom: '2027-01-01', dateTo: '2027-01-31' })
    expect(presetRange('last_month', NOW)).toEqual({ dateFrom: '2026-12-01', dateTo: '2026-12-31' })
    expect(presetRange('last_3_months', NOW)).toEqual({ dateFrom: '2026-11-01', dateTo: '2027-01-31' })
    expect(presetRange('all', NOW)).toEqual({ dateFrom: null, dateTo: null })
  })

  it('tháng 2 năm nhuận', () => {
    expect(presetRange('this_month', '2028-02-10T03:00:00Z')).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' })
  })
})

describe('isWholeCalendarMonth', () => {
  it('đúng một tháng trọn vẹn', () => {
    expect(isWholeCalendarMonth('2026-02-01', '2026-02-28')).toBe(true)
  })
  it.each([
    ['thiếu ngày cuối', '2026-02-01', '2026-02-27'],
    ['không bắt đầu từ ngày 1', '2026-02-02', '2026-02-28'],
    ['hai tháng', '2026-01-01', '2026-02-28'],
    ['toàn bộ thời gian', null, null],
    ['chỉ có ngày đầu', '2026-02-01', null],
  ])('%s -> false', (_, from, to) => {
    expect(isWholeCalendarMonth(from, to)).toBe(false)
  })
})

describe('formatPeriodRange', () => {
  it('định dạng dd/MM/yyyy, không lệch múi giờ', () => {
    expect(formatPeriodRange('2026-11-01', '2026-11-30')).toBe('01/11/2026 – 30/11/2026')
    expect(formatPeriodRange('2026-11-01', null)).toBe('Từ 01/11/2026')
    expect(formatPeriodRange(null, '2026-11-30')).toBe('Đến 30/11/2026')
    expect(formatPeriodRange(null, null)).toBe('Toàn bộ thời gian')
  })
})
