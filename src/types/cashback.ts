import { z } from 'zod'

/**
 * Rule hoàn tiền của một thẻ. `mcc = null` là rule MẶC ĐỊNH, áp cho mọi giao dịch không khớp
 * rule MCC nào (kể cả giao dịch chưa gán MCC). Ngưỡng và trần áp RIÊNG cho từng rule, theo
 * chu kỳ sao kê.
 */
export const CashbackRuleSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  mcc: z.string().regex(/^\d{4}$/).nullable(),
  ratePercent: z.number().min(0).max(100),
  minCycleSpend: z.number().int().min(0),
  capPerCycle: z.number().int().positive().nullable(),
})

export type CashbackRule = z.infer<typeof CashbackRuleSchema>

/** Kết quả tính hoàn tiền cho MỘT rule trong một chu kỳ. */
export interface RuleCashback {
  ruleId: string
  mcc: string | null
  ratePercent: number
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
  total: number
  byRule: RuleCashback[]
  /** Chi không thuộc rule nào (không khớp MCC nào và thẻ không có rule mặc định). */
  unmatchedSpend: number
}
