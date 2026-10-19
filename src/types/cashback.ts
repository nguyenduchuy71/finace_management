import { z } from 'zod'

/** Bậc thang thêm của một rule: chi từ `minSpend` thì áp `ratePercent` cho CẢ khoản chi của rule. */
export const CashbackTierSchema = z.object({
  minSpend: z.number().int().positive(),
  ratePercent: z.number().min(0).max(100),
})

export type CashbackTier = z.infer<typeof CashbackTierSchema>

/**
 * Rule hoàn tiền của một thẻ. `mcc = null` là rule MẶC ĐỊNH, áp cho mọi giao dịch không khớp
 * rule MCC nào (kể cả giao dịch chưa gán MCC). Ngưỡng và trần áp RIÊNG cho từng rule, theo
 * chu kỳ sao kê. `ratePercent` + `minCycleSpend` là BẬC NỀN; `tiers` là các bậc cao hơn (có thể rỗng).
 */
export const CashbackRuleSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  mcc: z.string().regex(/^\d{4}$/).nullable(),
  ratePercent: z.number().min(0).max(100),
  minCycleSpend: z.number().int().min(0),
  capPerCycle: z.number().int().positive().nullable(),
  tiers: z.array(CashbackTierSchema).default([]),
})

export type CashbackRule = z.infer<typeof CashbackRuleSchema>

/** Giá trị gửi lên RPC save_cashback_rule: rule + TOÀN BỘ bậc thêm (RPC thay thế bậc cũ bằng danh sách này). */
export interface CashbackRuleInput {
  mcc: string | null
  ratePercent: number
  minCycleSpend: number
  capPerCycle: number | null
  tiers: CashbackTier[]
}

/** Kết quả tính hoàn tiền cho MỘT rule trong một chu kỳ. */
export interface RuleCashback {
  ruleId: string
  mcc: string | null
  /** % của bậc nền (không phải bậc đang áp: xem `appliedRatePercent`). */
  ratePercent: number
  /** % của bậc đang áp; 0 khi chưa đạt ngưỡng nền. */
  appliedRatePercent: number
  /** Bậc đang áp, đánh số theo mức chi tăng dần (0 = bậc nền); -1 khi chưa đạt ngưỡng nền. */
  tierIndex: number
  /** Bậc kế tiếp chưa đạt (để gợi ý "còn X nữa"); null khi đã ở bậc cao nhất. */
  nextTier: CashbackTier | null
  /** Tổng chi của giao dịch thuộc rule này. */
  spend: number
  minCycleSpend: number
  capPerCycle: number | null
  /** Số tiền hoàn sau khi đã áp ngưỡng và trần. */
  cashback: number
  /** Chi chưa đạt ngưỡng tối thiểu nên không được hoàn. */
  belowMin: boolean
  /** Tiền hoàn bị cắt ở trần. */
  capped: boolean
}

export interface CashbackResult {
  /** Tổng hoàn sau khi đã cắt ở trần thẻ. */
  total: number
  /** Tổng các rule trước khi cắt ở trần thẻ. */
  uncappedTotal: number
  cardCap: number | null
  /** Tổng bị cắt ở trần thẻ (chỉ số tổng, không phân bổ về từng rule). */
  cardCapped: boolean
  byRule: RuleCashback[]
  /** Chi không thuộc rule nào (không khớp MCC nào và thẻ không có rule mặc định). */
  unmatchedSpend: number
}
