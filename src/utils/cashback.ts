import type { CashbackResult, CashbackRule, CashbackTier, RuleCashback } from '@/types/cashback'
import type { CreditCardTransaction } from '@/types/creditCard'

type CashbackTx = Pick<CreditCardTransaction, 'amount' | 'mcc'>

/**
 * Tính hoàn tiền ƯỚC TÍNH của một thẻ trong một chu kỳ sao kê từ các giao dịch và rule.
 *
 * - Chỉ tính giao dịch CHI (amount < 0). Giao dịch dương (hoàn trả, thanh toán dư nợ) bị bỏ
 *   qua: refund thường chưa có MCC nên không biết trừ vào nhóm nào.
 * - Mỗi giao dịch thuộc đúng MỘT rule: rule có `mcc` trùng; không có thì rule mặc định
 *   (`mcc = null`); không có cả hai thì vào `unmatchedSpend` và không được hoàn.
 * - Mỗi rule: chi của nhóm < `minCycleSpend` thì hoàn 0 (`belowMin`). Ngược lại lấy BẬC CAO NHẤT
 *   có `minSpend <= chi` (bậc nền = `minCycleSpend`/`ratePercent`, cộng `tiers`) và áp % của bậc đó
 *   cho CẢ khoản chi, không lũy tiến, rồi chặn ở `capPerCycle` (`capped`).
 * - Sau khi cộng các rule mới cắt ở `cardCap` (trần cả thẻ, null = không giới hạn). Thứ tự là
 *   trần rule TRƯỚC, trần thẻ SAU; phần bị cắt không phân bổ ngược về từng rule.
 * - Làm tròn XUỐNG đồng, tính trên TỔNG của rule chứ không từng giao dịch, và dùng số nguyên
 *   (điểm cơ bản = % × 100) để tránh sai số số thực: 5,5% của 1.000.000 phải đúng 55.000.
 *   Ngân hàng làm tròn khác nhau, nên kết quả luôn là ước tính.
 */
export function computeCashback(
  rules: CashbackRule[],
  txs: CashbackTx[],
  cardCap: number | null = null
): CashbackResult {
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
    // Bậc nền đứng trước; sort ổn định nên bậc trùng mức chi với bậc nền thì bậc thêm thắng.
    // Không tin thứ tự đầu vào: dữ liệu bậc có thể về từ DB theo thứ tự bất kỳ.
    const ladder: CashbackTier[] = [
      { minSpend: rule.minCycleSpend, ratePercent: rule.ratePercent },
      ...rule.tiers,
    ].sort((a, b) => a.minSpend - b.minSpend)

    let tierIndex = -1
    ladder.forEach((tier, i) => { if (tier.minSpend <= spend) tierIndex = i })
    const applied = belowMin || tierIndex < 0 ? null : ladder[tierIndex]
    const nextTier = ladder[tierIndex + 1] ?? null

    const basisPoints = applied ? Math.round(applied.ratePercent * 100) : 0
    const uncapped = Math.floor((spend * basisPoints) / 10_000)
    const capped = rule.capPerCycle !== null && uncapped > rule.capPerCycle
    return {
      ruleId: rule.id,
      mcc: rule.mcc,
      ratePercent: rule.ratePercent,
      appliedRatePercent: applied?.ratePercent ?? 0,
      tierIndex: applied ? tierIndex : -1,
      nextTier,
      spend,
      minCycleSpend: rule.minCycleSpend,
      capPerCycle: rule.capPerCycle,
      cashback: capped ? rule.capPerCycle! : uncapped,
      belowMin,
      capped,
    }
  })

  const uncappedTotal = byRule.reduce((sum, r) => sum + r.cashback, 0)
  const cardCapped = cardCap !== null && uncappedTotal > cardCap
  return {
    total: cardCapped ? cardCap : uncappedTotal,
    uncappedTotal,
    cardCap,
    cardCapped,
    byRule,
    unmatchedSpend,
  }
}
