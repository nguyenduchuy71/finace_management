import { describe, it, expect, vi } from 'vitest'
import { registerRegenerate, triggerRegenerate } from './regenerate-registry'

describe('regenerate-registry', () => {
  it('chưa đăng ký thì trigger không làm gì', () => {
    expect(() => triggerRegenerate()).not.toThrow()
  })

  it('gọi handler đã đăng ký, hết gọi sau khi huỷ', () => {
    const fn = vi.fn()
    const unregister = registerRegenerate(fn)
    triggerRegenerate()
    expect(fn).toHaveBeenCalledTimes(1)
    unregister()
    triggerRegenerate()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('huỷ handler cũ không gỡ nhầm handler mới hơn', () => {
    const oldFn = vi.fn()
    const newFn = vi.fn()
    const unregisterOld = registerRegenerate(oldFn)
    const unregisterNew = registerRegenerate(newFn)
    unregisterOld()
    triggerRegenerate()
    expect(newFn).toHaveBeenCalledTimes(1)
    expect(oldFn).not.toHaveBeenCalled()
    unregisterNew()
  })
})
