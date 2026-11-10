import { describe, it, expect } from 'vitest'
import { isRangeSelectionComplete } from './date-range-selection'

describe('isRangeSelectionComplete', () => {
  const d = (day: number) => new Date(2026, 10, day)
  it('lần bấm đầu của react-day-picker v9 (from = to) chưa phải là xong', () => {
    expect(isRangeSelectionComplete({ from: d(3), to: d(3) })).toBe(false)
  })
  it('có hai đầu khác nhau -> xong', () => {
    expect(isRangeSelectionComplete({ from: d(3), to: d(9) })).toBe(true)
  })
  it('thiếu đầu hoặc bỏ chọn -> chưa xong', () => {
    expect(isRangeSelectionComplete({ from: d(3), to: undefined })).toBe(false)
    expect(isRangeSelectionComplete(undefined)).toBe(false)
  })
})
