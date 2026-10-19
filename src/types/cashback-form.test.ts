import { describe, it, expect } from 'vitest'
import { EMPTY_CASHBACK_FORM, ruleToFormInput, validateCashbackForm, type CashbackFormInput } from './cashback-form'

const valid: CashbackFormInput = { mcc: '5812', ratePercent: '5', minCycleSpend: '3.000.000', capPerCycle: '200.000' }
const run = (over: Partial<CashbackFormInput> = {}) => validateCashbackForm({ ...valid, ...over })

describe('validateCashbackForm — hợp lệ', () => {
  it('chuẩn hoá về số: % thập phân, tiền nguyên, mcc/cap', () => {
    const r = run()
    expect(r.ok && r.values).toEqual({ mcc: '5812', ratePercent: 5, minCycleSpend: 3_000_000, capPerCycle: 200_000 })
  })

  it('mcc rỗng = rule mặc định (null)', () => {
    const r = run({ mcc: '' })
    expect(r.ok && r.values.mcc).toBeNull()
  })

  it('ngưỡng để trống = 0, trần để trống = không giới hạn (null)', () => {
    const r = run({ minCycleSpend: '', capPerCycle: '' })
    expect(r.ok && r.values).toMatchObject({ minCycleSpend: 0, capPerCycle: null })
  })

  it.each([['5', 5], ['5,5', 5.5], ['5.5', 5.5], ['0', 0], ['100', 100], ['0,29', 0.29], ['12.34', 12.34], [' 7 ', 7]])(
    '% %j hợp lệ = %d', (v, want) => {
      const r = run({ ratePercent: v })
      expect(r.ok && r.values.ratePercent).toBe(want)
    }
  )
})

describe('validateCashbackForm — từ chối', () => {
  it.each(['', '101', '100.5', '5.555', '-1', 'abc', '1000', '5%', '5,,5', '.5'])('% %j bị chặn', (v) => {
    const r = run({ ratePercent: v })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.ratePercent).toBeTruthy()
  })

  it('nhóm MCC ngoài danh sách bị chặn (không ghi mã tuỳ ý vào DB)', () => {
    const r = run({ mcc: '1234' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.mcc).toMatch(/danh sách/)
  })

  // "1.5" từng âm thầm thành 15đ
  it.each(['1.5', '1,5', '1.500.00', '3tr', '-5'])('ngưỡng chi %j sai định dạng bị chặn', (v) => {
    const r = run({ minCycleSpend: v })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.minCycleSpend).toMatch(/sai định dạng/)
  })

  it('trần "0" bị chặn với thông điệp riêng (DB cấm 0, dễ nhầm với "không hoàn")', () => {
    const r = run({ capPerCycle: '0' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.capPerCycle).toMatch(/lớn hơn 0/)
  })

  it.each(['abc', '1.5', '20tr'])('trần %j sai định dạng bị chặn', (v) => {
    const r = run({ capPerCycle: v })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.capPerCycle).toBeTruthy()
  })

  it('form trống: chỉ ô % bắt buộc', () => {
    const r = validateCashbackForm(EMPTY_CASHBACK_FORM)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['ratePercent'])
  })

  it('mỗi ô báo lỗi riêng, không nuốt lỗi ô khác', () => {
    const r = run({ ratePercent: 'x', minCycleSpend: '1.5', capPerCycle: '0' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['capPerCycle', 'minCycleSpend', 'ratePercent'])
  })
})

describe('ruleToFormInput', () => {
  const rule = { id: 'r1', cardId: 'c1', mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000, tiers: [] }

  it('đi một vòng rule -> form -> giá trị không đổi', () => {
    const r = validateCashbackForm(ruleToFormInput(rule))
    expect(r.ok && r.values).toEqual({ mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000 })
  })

  it('rule mặc định, không ngưỡng, không trần -> ô trống', () => {
    const f = ruleToFormInput({ ...rule, mcc: null, minCycleSpend: 0, capPerCycle: null })
    expect(f).toEqual({ mcc: '', ratePercent: '5.5', minCycleSpend: '', capPerCycle: '' })
    const r = validateCashbackForm(f)
    expect(r.ok && r.values).toMatchObject({ mcc: null, minCycleSpend: 0, capPerCycle: null })
  })
})
