import { describe, it, expect } from 'vitest'
import { classifyTransaction, CATEGORY_TAXONOMY, getCategoryLabel } from './categories'
import { CATEGORIES } from '@/types/categories'

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

  it('khớp theo ranh giới từ, không theo chuỗi con', () => {
    expect(classifyTransaction('Phone bill VNPT')).toBe('Hóa đơn') // "pho" nằm trong "phone"
    expect(classifyTransaction('Beauty Salon')).toBe('Khác') // "be" nằm trong "beauty"
    expect(classifyTransaction('Be Group')).toBe('Di chuyển')
    expect(classifyTransaction('Phở Pho 24')).toBe('Ăn uống')
  })

  it('từ khoá tiếng Việt có dấu, kể cả chuỗi NFD từ iOS', () => {
    expect(classifyTransaction('Tiền điện tháng 10')).toBe('Hóa đơn')
    expect(classifyTransaction('Tiền điện'.normalize('NFD'))).toBe('Hóa đơn')
    expect(classifyTransaction('Cửa hàng xăng dầu số 5')).toBe('Di chuyển')
  })

  it("getCategoryLabel('Ăn uống') returns 'Ăn uống'", () => {
    expect(getCategoryLabel('Ăn uống')).toBe('Ăn uống')
  })

  it('CATEGORY_TAXONOMY should have all 6 categories', () => {
    expect(Object.keys(CATEGORY_TAXONOMY).length).toBe(6)
  })

  it('khoá CATEGORY_TAXONOMY trùng đúng thứ tự CATEGORIES (dropdown dùng CATEGORIES)', () => {
    expect(Object.keys(CATEGORY_TAXONOMY)).toEqual([...CATEGORIES])
  })
})
