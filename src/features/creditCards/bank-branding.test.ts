import { describe, it, expect } from 'vitest'
import { getBankBrand, canonicalBankName, KNOWN_BANK_NAMES } from './bank-branding'

// 19 ngân hàng thực tế có trong DB (select distinct bank_name from credit_cards)
const BANKS_IN_DB = [
  'ACB', 'BIDV', 'BaoVietBank', 'Cake', 'Eximbank', 'HDBank', 'HSBC', 'KBank',
  'LPBank', 'MSB', 'OCB', 'SHB', 'Sacombank', 'ShinhanBank', 'UOB', 'VIB',
  'VPBank', 'Vietinbank', 'WOORIVN',
]

describe('getBankBrand', () => {
  it.each(BANKS_IN_DB)('có màu riêng cho %s', (bank) => {
    const brand = getBankBrand(bank)
    expect(brand.short.length).toBeGreaterThan(0)
    expect(brand.short.length).toBeLessThanOrEqual(4)
    // không rơi vào fallback trung tính
    expect(brand.className).not.toContain('bg-muted')
  })

  it('ngân hàng lạ vẫn hiển thị được (không ném lỗi, không undefined)', () => {
    const brand = getBankBrand('Ngân Hàng Chưa Khai Báo')
    expect(brand.short.length).toBeGreaterThan(0)
    expect(brand.short.length).toBeLessThanOrEqual(4)
    expect(brand.className).toBeTruthy()
  })

  it('tên rỗng không làm vỡ UI', () => {
    expect(getBankBrand('').short).toBe('?')
  })

  it('tên toàn ký tự đặc biệt không làm vỡ UI', () => {
    expect(getBankBrand('---').short).toBe('?')
  })

  it('mọi ngân hàng đều có class cho cả light lẫn dark mode', () => {
    for (const bank of BANKS_IN_DB) {
      expect(getBankBrand(bank).className).toContain('dark:')
    }
  })
})

describe('canonicalBankName', () => {
  // Edge function so khớp bank_name bằng .eq() chính xác, phân biệt hoa thường.
  it.each([['vpbank', 'VPBank'], ['VPBANK', 'VPBank'], ['  shb ', 'SHB'], ['sacombank', 'Sacombank'], ['WooriVN', 'WOORIVN']])(
    'chuẩn hoá %j -> %j', (input, want) => {
      expect(canonicalBankName(input)).toBe(want)
    }
  )

  it('giữ nguyên (chỉ trim) tên ngân hàng chưa biết', () => {
    expect(canonicalBankName('  Some New Bank ')).toBe('Some New Bank')
  })

  it('không đoán mờ: "VPBank Mobifone" không bị đổi thành "VPBank"', () => {
    expect(canonicalBankName('VPBank Mobifone')).toBe('VPBank Mobifone')
  })

  it('mọi tên đã biết tự ánh xạ về chính nó', () => {
    for (const n of KNOWN_BANK_NAMES) expect(canonicalBankName(n)).toBe(n)
  })
})
