import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountUp } from './useCountUp'

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useCountUp', () => {
  it('giảm chuyển động: trả ngay giá trị cuối, không qua số trung gian', () => {
    mockReducedMotion(true)
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 1_500_000 } })
    expect(result.current).toBe(1_500_000)
    rerender({ v: 2_000_000 })
    expect(result.current).toBe(2_000_000)
  })

  it('chạy từ 0 tới đích qua các số nguyên trung gian rồi dừng đúng đích', async () => {
    mockReducedMotion(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { result } = renderHook(() => useCountUp(1_000_000, 600))
    expect(result.current).toBe(0)
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(1_000_000)
    expect(Number.isInteger(result.current)).toBe(true)
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(result.current).toBe(1_000_000)
  })

  it('cùng target (refetch nền) không chạy lại animation', async () => {
    mockReducedMotion(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 600), { initialProps: { v: 500 } })
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(result.current).toBe(500)
    rerender({ v: 500 })
    expect(result.current).toBe(500)
  })
})

describe('useCountUp — bật lại chuyển động giữa phiên', () => {
  it('đang giảm chuyển động rồi tắt đi: hiện đúng target, không kẹt ở 0', async () => {
    mockReducedMotion(true)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 600), { initialProps: { v: 800 } })
    expect(result.current).toBe(800)
    mockReducedMotion(false)
    rerender({ v: 800 })
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(result.current).toBe(800)
  })
})
