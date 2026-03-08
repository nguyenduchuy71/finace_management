import { describe, it, expect } from 'vitest'
import { classifyTransaction, CATEGORY_TAXONOMY, getCategoryLabel } from './categories'

describe('Category Classification', () => {
  it("classifyTransaction('Grab') returns 'Di chuyển'", () => {
    expect(classifyTransaction('Grab')).toBe('Di chuyển')
  })

  it("classifyTransaction('Shopee') returns 'Mua sắm'", () => {
    expect(classifyTransaction('Shopee')).toBe('Mua sắm')
  })

  it("classifyTransaction('Circle K') returns 'Ăn uống'", () => {
    expect(classifyTransaction('Circle K')).toBe('Ăn uống')
  })

  it("classifyTransaction('Electricity Bill') returns 'Hóa đơn'", () => {
    expect(classifyTransaction('Electricity Bill')).toBe('Hóa đơn')
  })

  it("classifyTransaction('Unknown Merchant') returns 'Khác'", () => {
    expect(classifyTransaction('Unknown Merchant')).toBe('Khác')
  })

  it('classifyTransaction(undefined) returns "Khác"', () => {
    expect(classifyTransaction(undefined)).toBe('Khác')
  })

  it("getCategoryLabel('Ăn uống') returns 'Ăn uống'", () => {
    expect(getCategoryLabel('Ăn uống')).toBe('Ăn uống')
  })

  it('CATEGORY_TAXONOMY should have all 6 categories', () => {
    expect(Object.keys(CATEGORY_TAXONOMY).length).toBe(6)
  })
})
