import { describe, it, expect } from 'vitest'
import {
  CardCapFormSchema, EMPTY_CASHBACK_FORM, MAX_TIERS, ruleToFormInput, validateCashbackForm,
  type CashbackFormInput, type TierFormRow,
} from './cashback-form'

const valid: CashbackFormInput = { mcc: '5812', ratePercent: '5', minCycleSpend: '3.000.000', capPerCycle: '200.000', tiers: [] }
const run = (over: Partial<CashbackFormInput> = {}) => validateCashbackForm({ ...valid, ...over })

describe('validateCashbackForm — hợp lệ', () => {
  it('chuẩn hoá về số: % thập phân, tiền nguyên, mcc/cap', () => {
    const r = run()
    expect(r.ok && r.values).toEqual({ mcc: '5812', ratePercent: 5, minCycleSpend: 3_000_000, capPerCycle: 200_000, tiers: [] })
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
    expect(r.ok && r.values).toEqual({ mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000, tiers: [] })
  })

  it('rule mặc định, không ngưỡng, không trần -> ô trống', () => {
    const f = ruleToFormInput({ ...rule, mcc: null, minCycleSpend: 0, capPerCycle: null })
    expect(f).toEqual({ mcc: '', ratePercent: '5.5', minCycleSpend: '', capPerCycle: '', tiers: [] })
    const r = validateCashbackForm(f)
    expect(r.ok && r.values).toMatchObject({ mcc: null, minCycleSpend: 0, capPerCycle: null })
  })
})

const row = (minSpend: string, ratePercent: string, key = `k${minSpend}`): TierFormRow => ({ key, minSpend, ratePercent })

describe('validateCashbackForm — bậc thang', () => {
  it('chuẩn hoá bậc về số và bỏ `key` khỏi giá trị gửi đi', () => {
    const r = run({ tiers: [row('10.000.000', '1'), row('20000000', '1,5')] })
    expect(r.ok && r.values.tiers).toEqual([
      { minSpend: 10_000_000, ratePercent: 1 },
      { minSpend: 20_000_000, ratePercent: 1.5 },
    ])
  })

  it('bậc đầu phải lớn hơn ngưỡng nền: bằng hoặc nhỏ hơn đều lỗi đúng dòng 0', () => {
    for (const min of ['3.000.000', '2.000.000']) {
      const r = run({ tiers: [row(min, '1')] })
      expect(!r.ok && r.errors.tierRows?.[0]?.minSpend).toMatch(/lớn hơn mức chi tối thiểu/)
    }
  })

  it('không có ngưỡng nền (để trống = 0): bậc 1đ vẫn hợp lệ, 0đ thì không', () => {
    expect(run({ minCycleSpend: '', tiers: [row('1', '1')] }).ok).toBe(true)
    const r = run({ minCycleSpend: '', tiers: [row('0', '1')] })
    expect(!r.ok && r.errors.tierRows?.[0]?.minSpend).toBeDefined()
  })

  it('bậc phải tăng dần chặt: lỗi gắn đúng dòng vi phạm, không phải dòng khác', () => {
    const r = run({ tiers: [row('10.000.000', '1'), row('10.000.000', '2'), row('5.000.000', '3')] })
    expect(!r.ok && r.errors.tierRows?.[0]).toBeUndefined()
    expect(!r.ok && r.errors.tierRows?.[1]?.minSpend).toMatch(/lớn hơn mức chi của bậc trước/)
    expect(!r.ok && r.errors.tierRows?.[2]?.minSpend).toMatch(/lớn hơn mức chi của bậc trước/)
  })

  it('dòng bậc còn trống hoặc thiếu một ô bị báo lỗi, không bị nuốt im lặng', () => {
    const empty = run({ tiers: [row('', '')] })
    expect(!empty.ok && empty.errors.tierRows?.[0]).toMatchObject({ minSpend: 'Nhập mức chi', ratePercent: expect.any(String) })
    const half = run({ tiers: [row('10.000.000', '')] })
    expect(!half.ok && half.errors.tierRows?.[0]?.ratePercent).toBeDefined()
    expect(!half.ok && half.errors.tierRows?.[0]?.minSpend).toBeUndefined()
  })

  it.each([['1.5'], ['1,5'], ['1,000.000'], ['abc'], ['-5']])('mức chi %j bị từ chối (không đoán dấu tách)', (v) => {
    const r = run({ tiers: [row(v, '1')] })
    expect(!r.ok && r.errors.tierRows?.[0]?.minSpend).toBeDefined()
  })

  it.each([['101'], ['1,234'], ['-1'], ['x']])('% bậc %j bị từ chối', (v) => {
    const r = run({ tiers: [row('10.000.000', v)] })
    expect(!r.ok && r.errors.tierRows?.[0]?.ratePercent).toBeDefined()
  })

  it(`tối đa ${MAX_TIERS} bậc: đủ ${MAX_TIERS} được, ${MAX_TIERS + 1} bị lỗi chung`, () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => row(String((i + 1) * 10_000_000), '1'))
    expect(run({ tiers: mk(MAX_TIERS) }).ok).toBe(true)
    const r = run({ tiers: mk(MAX_TIERS + 1) })
    expect(!r.ok && r.errors.tiers).toMatch(/Tối đa/)
  })

  it('ô ngưỡng nền sai định dạng thì không báo thêm lỗi giả ở dòng bậc', () => {
    const r = run({ minCycleSpend: '1.5', tiers: [row('1', '1')] })
    expect(!r.ok && r.errors.minCycleSpend).toBeDefined()
    expect(!r.ok && r.errors.tierRows).toBeUndefined()
  })

  it('lỗi ở ô thường vẫn báo cùng lúc với lỗi bậc', () => {
    const r = run({ ratePercent: 'x', tiers: [row('', '1')] })
    expect(!r.ok && r.errors.ratePercent).toBeDefined()
    expect(!r.ok && r.errors.tierRows?.[0]?.minSpend).toBeDefined()
  })

  it('rule -> form -> giá trị: bậc đi một vòng không đổi, có key riêng từng dòng', () => {
    const rule = {
      id: 'r1', cardId: 'c1', mcc: '5411', ratePercent: 0.5, minCycleSpend: 5_000_000, capPerCycle: null,
      tiers: [{ minSpend: 10_000_000, ratePercent: 1 }, { minSpend: 20_000_000, ratePercent: 1.5 }],
    }
    const f = ruleToFormInput(rule)
    expect(f.tiers.map(({ minSpend, ratePercent }) => ({ minSpend, ratePercent }))).toEqual([
      { minSpend: '10000000', ratePercent: '1' }, { minSpend: '20000000', ratePercent: '1.5' },
    ])
    expect(new Set(f.tiers.map((t) => t.key)).size).toBe(2)
    const r = validateCashbackForm(f)
    expect(r.ok && r.values.tiers).toEqual(rule.tiers)
  })
})

describe('CardCapFormSchema', () => {
  it('trống = không giới hạn; số hợp lệ được chuẩn hoá', () => {
    expect(CardCapFormSchema.parse('')).toBeNull()
    expect(CardCapFormSchema.parse('600.000')).toBe(600_000)
  })

  it.each([['0'], ['-1'], ['1.5'], ['abc']])('%j bị từ chối', (v) => {
    expect(CardCapFormSchema.safeParse(v).success).toBe(false)
  })

  it('"0" báo rõ phải lớn hơn 0 và nêu đúng là trần cả thẻ', () => {
    const r = CardCapFormSchema.safeParse('0')
    expect(!r.success && r.error.issues[0].message).toMatch(/Trần hoàn cả thẻ phải lớn hơn 0/)
  })
})
