import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from './useNow'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-09T16:30:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('useNow', () => {
  it('khởi tạo bằng thời điểm hiện tại', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe('2026-04-09T16:30:00.000Z')
  })

  it('tự cập nhật theo chu kỳ', () => {
    const { result } = renderHook(() => useNow(60_000))
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current).toBe('2026-04-09T16:31:00.000Z')
    act(() => { vi.advanceTimersByTime(120_000) })
    expect(result.current).toBe('2026-04-09T16:33:00.000Z')
  })

  it('chưa đến hạn thì giữ nguyên', () => {
    const { result } = renderHook(() => useNow(60_000))
    act(() => { vi.advanceTimersByTime(59_999) })
    expect(result.current).toBe('2026-04-09T16:30:00.000Z')
  })

  it('huỷ interval khi unmount (không rò timer)', () => {
    const { unmount } = renderHook(() => useNow(60_000))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
