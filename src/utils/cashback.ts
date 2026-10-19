import type { CashbackResult, CashbackRule, RuleCashback } from '@/types/cashback'
import type { CreditCardTransaction } from '@/types/creditCard'

type CashbackTx = Pick<CreditCardTransaction, 'amount' | 'mcc'>

/**
 * Tính hoàn tiền ƯỚC TÍNH của một thẻ trong một chu kỳ sao kê từ các giao dịch và rule.
 *
 * - Chỉ tính giao dịch CHI (amount < 0). Giao dịch dương (hoàn trả, thanh toán dư nợ) bị bỏ
 *   qua: refund thường chưa có MCC nên không biết trừ vào nhóm nào.
 * - Mỗi giao dịch thuộc đúng MỘT rule: rule có `mcc` trùng; không có thì rule mặc định
 *   (`mcc = null`); không có cả hai thì vào `unmatchedSpend` và không được hoàn.
 * - Mỗi rule: chi của nhóm < `minCycleSpend` thì hoàn 0 (`belowMin`); ngược lại hoàn
 *   `chi × %` rồi chặn ở `capPerCycle` (`capped`).
 * - Làm tròn XUỐNG đồng, tính trên TỔNG của rule chứ không từng giao dịch, và dùng số nguyên
 *   (điểm cơ bản = % × 100) để tránh sai số số thực: 5,5% của 1.000.000 phải đúng 55.000.
 *   Ngân hàng làm tròn khác nhau, nên kết quả luôn là ước tính.
 */
export function computeCashback(rules: CashbackRule[], txs: CashbackTx[]): CashbackResult {
  const byMcc = new Map<string, CashbackRule>()
  let defaultRule: CashbackRule | undefined
  for (const rule of rules) {
    if (rule.mcc === null) defaultRule = rule
    else byMcc.set(rule.mcc, rule)
  }

  const spendByRule = new Map<string, number>()
  let unmatchedSpend = 0

  for (const tx of txs) {
    if (tx.amount >= 0) continue
    const spend = -tx.amount
    const rule = (tx.mcc ? byMcc.get(tx.mcc) : undefined) ?? defaultRule
    if (!rule) {
      unmatchedSpend += spend
      continue
    }
    spendByRule.set(rule.id, (spendByRule.get(rule.id) ?? 0) + spend)
  }

  const byRule: RuleCashback[] = rules.map((rule) => {
    const spend = spendByRule.get(rule.id) ?? 0
    const belowMin = spend < rule.minCycleSpend
    const basisPoints = Math.round(rule.ratePercent * 100)
    const uncapped = belowMin ? 0 : Math.floor((spend * basisPoints) / 10_000)
    const capped = rule.capPerCycle !== null && uncapped > rule.capPerCycle
    return {
      ruleId: rule.id,
      mcc: rule.mcc,
      ratePercent: rule.ratePercent,
      spend,
      minCycleSpend: rule.minCycleSpend,
      capPerCycle: rule.capPerCycle,
      cashback: capped ? rule.capPerCycle! : uncapped,
      belowMin,
      capped,
    }
  })

  return {
    total: byRule.reduce((sum, r) => sum + r.cashback, 0),
    byRule,
    unmatchedSpend,
  }
}
