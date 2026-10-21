import { describe, it, expect } from 'vitest'
import { getCategoryChartColor } from './category-colors'
import { CATEGORY_TAXONOMY } from './categories'

describe('getCategoryChartColor', () => {
  it('mỗi danh mục thật có màu riêng (không trùng, không rơi về "Khác")', () => {
    const categories = Object.keys(CATEGORY_TAXONOMY)
    const colors = categories.map(getCategoryChartColor)
    expect(new Set(colors).size).toBe(categories.length)
  })

  it('danh mục lạ dùng màu của "Khác"', () => {
    expect(getCategoryChartColor('food')).toBe(getCategoryChartColor('Khác'))
  })
})
