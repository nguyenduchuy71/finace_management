import { describe, it, expect } from 'vitest'
import { computeCashback } from './cashback'
import type { CashbackRule } from '@/types/cashback'

let n = 0
const rule = (over: Partial<CashbackRule> = {}): CashbackRule => ({
  id: `r${++n}`, cardId: 'c1', mcc: null, ratePercent: 0.5, minCycleSpend: 5_000_000, capPerCycle: null, tiers: [], ...over,
})
const spend = (amount: number, mcc?: string) => ({ amount: -amount, mcc })
const ladder = (over: Partial<CashbackRule> = {}) =>
  rule({ tiers: [{ minSpend: 10_000_000, ratePercent: 1 }], ...over })

describe('computeCashback — bậc thang', () => {
  it('tương thích ngược: không có bậc thêm thì như một ngưỡng + một %', () => {
    const r = computeCashback([rule()], [spend(6_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 30_000, tierIndex: 0, appliedRatePercent: 0.5, nextTier: null })
  })

  it('vách đá: 9.999.999đ ở bậc nền, đúng 10.000.000đ nhảy lên bậc 1% cho CẢ khoản chi', () => {
    const below = computeCashback([ladder()], [spend(9_999_999)]).byRule[0]
    const at = computeCashback([ladder()], [spend(10_000_000)]).byRule[0]
    expect(below).toMatchObject({ cashback: 49_999, tierIndex: 0, appliedRatePercent: 0.5 })
    expect(at).toMatchObject({ cashback: 100_000, tierIndex: 1, appliedRatePercent: 1 })
  })

  it('ngưỡng nền dùng >=: chi đúng 5.000.000đ đã được hoàn, 4.999.999đ thì không', () => {
    expect(computeCashback([ladder()], [spend(5_000_000)]).byRule[0]).toMatchObject({ cashback: 25_000, belowMin: false })
    expect(computeCashback([ladder()], [spend(4_999_999)]).byRule[0]).toMatchObject({
      cashback: 0, belowMin: true, tierIndex: -1, appliedRatePercent: 0,
    })
  })

  it('bậc đầu vào xếp sai thứ tự vẫn ra cùng kết quả', () => {
    const tiers = [
      { minSpend: 20_000_000, ratePercent: 1.5 },
      { minSpend: 10_000_000, ratePercent: 1 },
    ]
    const sorted = [...tiers].reverse()
    const a = computeCashback([rule({ tiers })], [spend(12_000_000)]).byRule[0]
    const b = computeCashback([rule({ tiers: sorted })], [spend(12_000_000)]).byRule[0]
    expect(a).toEqual({ ...b, ruleId: a.ruleId })
    expect(a).toMatchObject({ cashback: 120_000, tierIndex: 1, nextTier: { minSpend: 20_000_000, ratePercent: 1.5 } })
  })

  it('bậc cao hơn có % THẤP hơn vẫn được áp (không giả định % tăng dần)', () => {
    const r = computeCashback([rule({ tiers: [{ minSpend: 10_000_000, ratePercent: 0.2 }] })], [spend(10_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 20_000, appliedRatePercent: 0.2 })
  })

  it('bậc 0% cho hoàn 0 nhưng không bị coi là chưa đạt ngưỡng', () => {
    const r = computeCashback([rule({ tiers: [{ minSpend: 10_000_000, ratePercent: 0 }] })], [spend(11_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 0, belowMin: false, tierIndex: 1 })
  })

  it('bậc trùng mức chi với bậc nền: bậc thêm thắng', () => {
    const r = computeCashback([rule({ tiers: [{ minSpend: 5_000_000, ratePercent: 2 }] })], [spend(5_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 100_000, appliedRatePercent: 2 })
  })

  it('làm tròn xuống trên bậc: 0,57% × 1.000.000 = 5.700 (số thực cho 5.699)', () => {
    const r = computeCashback([rule({ minCycleSpend: 0, tiers: [{ minSpend: 1_000_000, ratePercent: 0.57 }] })], [spend(1_000_000)])
    expect(r.byRule[0].cashback).toBe(5_700)
  })

  it('nextTier: dưới ngưỡng nền trỏ về bậc nền; ở bậc cuối là null', () => {
    const low = computeCashback([ladder()], [spend(1_000_000)]).byRule[0]
    expect(low.nextTier).toEqual({ minSpend: 5_000_000, ratePercent: 0.5 })
    const top = computeCashback([ladder()], [spend(99_000_000)]).byRule[0]
    expect(top.nextTier).toBeNull()
  })

  it('bậc áp riêng cho từng rule theo chi của chính rule đó', () => {
    const rules = [
      ladder({ mcc: '5812', minCycleSpend: 0 }),
      ladder({ mcc: null, minCycleSpend: 0, ratePercent: 0.1 }),
    ]
    const r = computeCashback(rules, [spend(10_000_000, '5812'), spend(9_000_000, '5411')])
    expect(r.byRule[0]).toMatchObject({ spend: 10_000_000, appliedRatePercent: 1, cashback: 100_000 })
    expect(r.byRule[1]).toMatchObject({ spend: 9_000_000, appliedRatePercent: 0.1, cashback: 9_000 })
  })

  it('trần rule áp lên số hoàn của bậc đang áp', () => {
    const r = computeCashback([ladder({ capPerCycle: 60_000 })], [spend(10_000_000)])
    expect(r.byRule[0]).toMatchObject({ cashback: 60_000, capped: true })
  })
})

describe('computeCashback — trần tổng thẻ', () => {
  const two = () => [
    rule({ mcc: '5812', minCycleSpend: 0, ratePercent: 3 }),
    rule({ mcc: '5411', minCycleSpend: 0, ratePercent: 4 }),
  ]
  const txs = [spend(10_000_000, '5812'), spend(10_000_000, '5411')] // 300k + 400k

  it('không có trần thẻ: cộng thẳng các rule', () => {
    const r = computeCashback(two(), txs)
    expect(r).toMatchObject({ total: 700_000, uncappedTotal: 700_000, cardCap: null, cardCapped: false })
  })

  it('tổng các rule vượt trần thẻ thì bị cắt về trần, rule không bị đổi', () => {
    const r = computeCashback(two(), txs, 600_000)
    expect(r).toMatchObject({ total: 600_000, uncappedTotal: 700_000, cardCap: 600_000, cardCapped: true })
    expect(r.byRule.map((x) => x.cashback)).toEqual([300_000, 400_000])
  })

  it('trần thẻ cao hơn tổng: không cắt', () => {
    expect(computeCashback(two(), txs, 700_001)).toMatchObject({ total: 700_000, cardCapped: false })
  })

  it('tổng đúng bằng trần thẻ: chưa tính là bị cắt', () => {
    expect(computeCashback(two(), txs, 700_000)).toMatchObject({ total: 700_000, cardCapped: false })
  })

  it('thứ tự cắt: trần rule trước rồi trần thẻ (rule A thô 500k bị cắt về 100k, B 200k, trần thẻ 250k)', () => {
    const rules = [
      rule({ mcc: '5812', minCycleSpend: 0, ratePercent: 5, capPerCycle: 100_000 }),
      rule({ mcc: '5411', minCycleSpend: 0, ratePercent: 2 }),
    ]
    const r = computeCashback(rules, [spend(10_000_000, '5812'), spend(10_000_000, '5411')], 250_000)
    expect(r.byRule.map((x) => x.cashback)).toEqual([100_000, 200_000])
    expect(r).toMatchObject({ uncappedTotal: 300_000, total: 250_000, cardCapped: true })
  })

  it('trần thẻ kết hợp bậc thang', () => {
    const r = computeCashback([ladder()], [spend(10_000_000)], 80_000)
    expect(r).toMatchObject({ uncappedTotal: 100_000, total: 80_000, cardCapped: true })
  })

  it('không rule nào: trần thẻ không làm tổng âm hay khác 0', () => {
    expect(computeCashback([], [spend(1_000_000)], 500_000)).toMatchObject({ total: 0, cardCapped: false })
  })
})
