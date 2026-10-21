import { describe, it, expect } from 'vitest'
import { computeNetFlow } from './cashflow'

describe('computeNetFlow', () => {
  it('thu > chi: ròng dương, tỉ lệ chi/thu làm tròn', () => {
    expect(computeNetFlow(10_000_000, 7_250_000)).toEqual({ net: 2_750_000, spendRatio: 73 })
  })

  it('chi vượt thu: ròng âm, tỉ lệ > 100', () => {
    expect(computeNetFlow(4_000_000, 6_000_000)).toEqual({ net: -2_000_000, spendRatio: 150 })
  })

  it('không có thu: tỉ lệ null thay vì Infinity/NaN', () => {
    expect(computeNetFlow(0, 500_000)).toEqual({ net: -500_000, spendRatio: null })
    expect(computeNetFlow(0, 0)).toEqual({ net: 0, spendRatio: null })
  })
})
