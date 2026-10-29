import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readJSON, writeJSON, readString, writeString, removeKey } from './persisted-json'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('persisted-json: storage bình thường', () => {
  it('ghi rồi đọc lại, đúng định dạng JSON thuần (không envelope)', () => {
    expect(writeJSON('k', { a: 1 })).toBe(true)
    expect(localStorage.getItem('k')).toBe('{"a":1}')
    expect(readJSON('k', null)).toEqual({ a: 1 })
  })

  it('thiếu khoá / JSON hỏng -> fallback', () => {
    expect(readJSON('none', ['x'])).toEqual(['x'])
    localStorage.setItem('bad', '{oops')
    expect(readJSON('bad', 7)).toBe(7)
  })

  it('guard từ chối hình dạng sai -> fallback', () => {
    localStorage.setItem('k', '"chuỗi"')
    const isObj = (v: unknown): v is object => typeof v === 'object' && v !== null
    expect(readJSON('k', {}, isObj)).toEqual({})
    localStorage.setItem('k', '{"a":1}')
    expect(readJSON('k', {}, isObj)).toEqual({ a: 1 })
  })

  it('chuỗi thô và xoá khoá', () => {
    writeString('t', 'dark')
    expect(readString('t')).toBe('dark')
    expect(localStorage.getItem('t')).toBe('dark')
    removeKey('t')
    expect(readString('t')).toBeNull()
  })
})

describe('persisted-json: localStorage ném lỗi', () => {
  const boom = () => { throw new DOMException('quota', 'QuotaExceededError') }

  it('không ném khi đọc/ghi/xoá, trả fallback hoặc false', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)
    expect(readJSON('k', 'fb')).toBe('fb')
    expect(readString('k')).toBeNull()
    expect(writeJSON('k', 1)).toBe(false)
    expect(writeString('k', 'x')).toBe(false)
    expect(() => removeKey('k')).not.toThrow()
  })
})
