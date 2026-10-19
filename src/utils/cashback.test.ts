import { describe, it, expect } from 'vitest'
import { computeCashback } from './cashback'
import type { CashbackRule } from '@/types/cashback'

let n = 0
const rule = (over: Partial<CashbackRule> = {}): CashbackRule => ({
  id: `r${++n}`, cardId: 'c1', mcc: null, ratePercent: 1, minCycleSpend: 0, capPerCycle: null, ...over,
})
const spend = (amount: number, mcc?: string) => ({ amount: -amount, mcc })

describe('computeCashback — cơ bản', () => {
  it('không có rule: không hoàn gì, toàn bộ chi là unmatched', () => {
    const r = computeCashback([], [spend(100000), spend(50000, '5411')])
    expect(r.total).toBe(0)
    expect(r.byRule).toEqual([])
    expect(r.unmatchedSpend).toBe(150000)
  })

  it('không có giao dịch: mọi rule hoàn 0 và không báo "chưa đạt ngưỡng" sai', () => {
    const r = computeCashback([rule({ mcc: '5411', ratePercent: 5 })], [])
    expect(r.total).toBe(0)
    expect(r.byRule[0]).toMatchObject({ spend: 0, cashback: 0, belowMin: false, capped: false })
  })

  it('chỉ có rule mặc định: áp cho mọi giao dịch, kể cả chưa gán MCC', () => {
    const r = computeCashback([rule({ ratePercent: 1 })], [spend(1_000_000), spend(500_000, '5411')])
    expect(r.total).toBe(15_000)
    expect(r.byRule[0].spend).toBe(1_500_000)
    expect(r.unmatchedSpend).toBe(0)
  })

  it('giao dịch khớp MCC dùng rule MCC, phần còn lại dùng rule mặc định', () => {
    const rules = [rule({ mcc: '5812', ratePercent: 5 }), rule({ mcc: null, ratePercent: 0.5 })]
    const r = computeCashback(rules, [spend(200_000, '5812'), spend(1_000_000, '5411'), spend(100_000)])
    expect(r.byRule[0]).toMatchObject({ mcc: '5812', spend: 200_000, cashback: 10_000 })
    expect(r.byRule[1]).toMatchObject({ mcc: null, spend: 1_100_000, cashback: 5_500 })
    expect(r.total).toBe(15_500)
  })

  it('có rule MCC nhưng không có rule mặc định: giao dịch khác MCC là unmatched', () => {
    const r = computeCashback([rule({ mcc: '5812', ratePercent: 5 })], [spend(100_000, '5812'), spend(70_000, '5411'), spend(30_000)])
    expect(r.total).toBe(5_000)
    expect(r.unmatchedSpend).toBe(100_000)
  })
})

describe('computeCashback — chỉ tính giao dịch chi', () => {
  it('bỏ qua giao dịch dương (hoàn trả, thanh toán dư nợ) và amount = 0', () => {
    const r = computeCashback([rule({ ratePercent: 10 })], [spend(100_000), { amount: 500_000 }, { amount: 0 }, { amount: 30_000, mcc: '5411' }])
    expect(r.byRule[0].spend).toBe(100_000)
    expect(r.total).toBe(10_000)
    expect(r.unmatchedSpend).toBe(0)
  })
})

describe('computeCashback — ngưỡng chi tối thiểu (theo từng rule)', () => {
  const r5812 = () => rule({ mcc: '5812', ratePercent: 5, minCycleSpend: 3_000_000 })

  it('chi dưới ngưỡng: hoàn 0 và đánh dấu belowMin', () => {
    const r = computeCashback([r5812()], [spend(2_999_999, '5812')])
    expect(r.total).toBe(0)
    expect(r.byRule[0]).toMatchObject({ belowMin: true, cashback: 0, spend: 2_999_999 })
  })

  it('chi đúng bằng ngưỡng: được hoàn (ngưỡng tính "từ")', () => {
    const r = computeCashback([r5812()], [spend(3_000_000, '5812')])
    expect(r.byRule[0]).toMatchObject({ belowMin: false, cashback: 150_000 })
  })

  it('ngưỡng của rule này không phụ thuộc chi của nhóm khác', () => {
    const rules = [r5812(), rule({ mcc: '5411', ratePercent: 1 })]
    const r = computeCashback(rules, [spend(1_000_000, '5812'), spend(10_000_000, '5411')])
    expect(r.byRule[0].belowMin).toBe(true)
    expect(r.byRule[1]).toMatchObject({ belowMin: false, cashback: 100_000 })
    expect(r.total).toBe(100_000)
  })

  it('ngưỡng của rule mặc định tính trên chi KHÔNG thuộc rule MCC nào', () => {
    const rules = [rule({ mcc: '5812', ratePercent: 5 }), rule({ mcc: null, ratePercent: 1, minCycleSpend: 1_000_000 })]
    const r = computeCashback(rules, [spend(5_000_000, '5812'), spend(900_000)])
    expect(r.byRule[1]).toMatchObject({ spend: 900_000, belowMin: true, cashback: 0 })
  })
})

describe('computeCashback — trần hoàn mỗi kỳ (theo từng rule)', () => {
  it('chặn ở trần và đánh dấu capped', () => {
    const r = computeCashback([rule({ mcc: '5812', ratePercent: 5, capPerCycle: 200_000 })], [spend(10_000_000, '5812')])
    expect(r.byRule[0]).toMatchObject({ cashback: 200_000, capped: true })
  })

  it('đúng bằng trần: không coi là capped', () => {
    const r = computeCashback([rule({ ratePercent: 5, capPerCycle: 50_000 })], [spend(1_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 50_000, capped: false })
  })

  it('dưới trần: giữ nguyên', () => {
    const r = computeCashback([rule({ ratePercent: 5, capPerCycle: 200_000 })], [spend(1_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 50_000, capped: false })
  })

  it('trần chỉ cắt rule của nó, tổng cộng các rule', () => {
    const rules = [rule({ mcc: '5812', ratePercent: 5, capPerCycle: 100_000 }), rule({ mcc: '5411', ratePercent: 2 })]
    const r = computeCashback(rules, [spend(10_000_000, '5812'), spend(1_000_000, '5411')])
    expect(r.total).toBe(100_000 + 20_000)
  })

  it('chưa đạt ngưỡng thì không capped dù trần nhỏ', () => {
    const r = computeCashback([rule({ ratePercent: 5, minCycleSpend: 5_000_000, capPerCycle: 1 })], [spend(1_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 0, belowMin: true, capped: false })
  })
})

describe('computeCashback — làm tròn và độ chính xác', () => {
  it('làm tròn XUỐNG đồng', () => {
    expect(computeCashback([rule({ ratePercent: 1 })], [spend(199)]).total).toBe(1) // 1,99 -> 1
    expect(computeCashback([rule({ ratePercent: 1 })], [spend(99)]).total).toBe(0)
  })

  it('tính trên TỔNG của rule, không làm tròn từng giao dịch', () => {
    // 3 × 99đ ở 1% = 2,97đ -> 2đ; làm tròn từng giao dịch sẽ ra 0đ
    expect(computeCashback([rule({ ratePercent: 1 })], [spend(99), spend(99), spend(99)]).total).toBe(2)
  })

  it('không dính sai số số thực với % lẻ', () => {
    expect(computeCashback([rule({ ratePercent: 5.5 })], [spend(1_000_000)]).total).toBe(55_000)
    expect(computeCashback([rule({ ratePercent: 0.1 })], [spend(1_000_000)]).total).toBe(1_000)
    expect(computeCashback([rule({ ratePercent: 0.29 })], [spend(1_000_000)]).total).toBe(2_900) // 0.29*100 = 28.999999…
    expect(computeCashback([rule({ ratePercent: 1.15 })], [spend(1_000_000)]).total).toBe(11_500)
  })

  // Các cặp (%, chi) mà `Math.floor(chi * (% / 100))` bằng số thực cho kết quả THIẾU 1đ:
  // 0,57% × 1.000.000 = 5.699 (đúng là 5.700). Đây là lý do tính bằng điểm cơ bản nguyên.
  it.each([
    [0.57, 1_000_000, 5_700],
    [0.57, 100_000, 570],
    [0.29, 10_000, 29],
    [0.29, 2_500_000, 7_250],
    [0.29, 5_000_000, 14_500],
  ])('số thực sẽ thiếu 1đ: %s%% × %s đ => %s đ', (rate, amount, want) => {
    expect(computeCashback([rule({ ratePercent: rate })], [spend(amount)]).total).toBe(want)
  })

  it('0% và 100% là biên hợp lệ', () => {
    expect(computeCashback([rule({ ratePercent: 0 })], [spend(1_000_000)]).total).toBe(0)
    expect(computeCashback([rule({ ratePercent: 100 })], [spend(1_000_000)]).total).toBe(1_000_000)
  })

  it('số tiền lớn vẫn là số nguyên chính xác', () => {
    expect(computeCashback([rule({ ratePercent: 10 })], [spend(5_000_000_000)]).total).toBe(500_000_000)
  })
})

describe('computeCashback — giữ nguyên thứ tự và không đột biến đầu vào', () => {
  it('byRule theo đúng thứ tự rule truyền vào và có đủ mọi rule (kể cả chi 0)', () => {
    const rules = [rule({ mcc: '5812' }), rule({ mcc: '5411' }), rule({ mcc: null })]
    const r = computeCashback(rules, [spend(100, '5411')])
    expect(r.byRule.map((x) => x.ruleId)).toEqual(rules.map((x) => x.id))
  })

  it('không sửa mảng đầu vào', () => {
    const rules = [rule({ mcc: '5812', ratePercent: 5 })]
    const txs = [spend(100_000, '5812')]
    const snapshot = JSON.stringify({ rules, txs })
    computeCashback(rules, txs)
    expect(JSON.stringify({ rules, txs })).toBe(snapshot)
  })
})
