import { describe, it, expect } from 'vitest'
import { formatVND, formatVNDSigned } from './currency'

describe('formatVND', () => {
  it('formats 1500000 as đ 1.500.000', () => {
    expect(formatVND(1_500_000)).toBe('đ 1.500.000')
  })
  it('formats 500000 as đ 500.000', () => {
    expect(formatVND(500_000)).toBe('đ 500.000')
  })
  it('formats 0 as đ 0', () => {
    expect(formatVND(0)).toBe('đ 0')
  })
})

describe('formatVNDSigned', () => {
  it('formats negative amount with leading minus', () => {
    expect(formatVNDSigned(-500_000)).toBe('- đ 500.000')
  })
  it('formats positive amount without sign', () => {
    expect(formatVNDSigned(1_500_000)).toBe('đ 1.500.000')
  })
})
