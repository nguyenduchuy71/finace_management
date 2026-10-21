import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MeterBar } from '@/components/ui/MeterBar'
import { Coins } from 'lucide-react'
import { useCycleCashback } from '@/hooks/useCycleCashback'
import { formatVND } from '@/utils/currency'
import { formatMcc } from '@/utils/mcc'
import type { RuleCashback } from '@/types/cashback'
import type { CreditCard } from '@/types/creditCard'
import { CashbackRulesEditor } from './CashbackRulesEditor'
import { DEFAULT_RULE_LABEL } from '@/types/cashback-form'

interface CashbackSummaryProps {
  card: CreditCard
  cycle: { startISO: string; endISO: string }
}

/** Thanh của một rule: tiến tới bậc kế tiếp (ưu tiên — gợi ý hành động) hoặc mức đã dùng của trần rule. */
function ruleMeter(r: RuleCashback): { percent: number; label: string } | null {
  if (!r.belowMin && r.nextTier) {
    return { percent: (r.spend / r.nextTier.minSpend) * 100, label: `Tiến tới bậc ${r.nextTier.ratePercent}%` }
  }
  if (r.capPerCycle) return { percent: (r.cashback / r.capPerCycle) * 100, label: 'Đã dùng trần của rule' }
  return null
}

function RuleLine({ r }: { r: RuleCashback }) {
  const meter = ruleMeter(r)
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="font-medium">{r.mcc ? formatMcc(r.mcc) : DEFAULT_RULE_LABEL}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            chi {formatVND(r.spend)} · {r.belowMin ? r.ratePercent : r.appliedRatePercent}%
          </span>
          {!r.belowMin && r.nextTier && (
            <p className="text-xs text-muted-foreground">
              Còn {formatVND(r.nextTier.minSpend - r.spend)} nữa để lên bậc {r.nextTier.ratePercent}%
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {r.belowMin && (
            <Badge variant="secondary" className="text-xs">
              Chưa đạt ngưỡng {formatVND(r.minCycleSpend)}
            </Badge>
          )}
          {r.capped && <Badge variant="secondary" className="text-xs">Đã chạm trần</Badge>}
          <span className="font-semibold money text-cashback">{formatVND(r.cashback)}</span>
        </div>
      </div>
      {meter && <MeterBar percent={meter.percent} label={meter.label} fillClassName="bg-cashback-strong" className="h-1.5" />}
    </li>
  )
}

/**
 * Hoàn tiền ƯỚC TÍNH của chu kỳ hiện tại, tính từ rule của thẻ + MCC user đã gán cho giao dịch.
 * Luôn ghi "ước tính": mỗi ngân hàng làm tròn và hạch toán khác nhau.
 */
export function CashbackSummary({ card, cycle }: CashbackSummaryProps) {
  const { result, rules, isLoading, isError, refetch } = useCycleCashback(card.id, cycle, card.cashbackMonthlyCap)
  const [editorOpen, setEditorOpen] = useState(false)

  // Chỉ liệt kê rule có phát sinh chi; rule chưa có giao dịch nào chỉ làm rối.
  // Lỗi sau khi đã tải được một lần: `result` vẫn còn từ cache nhưng đã cũ — ẩn đi thay vì
  // hiện một con số tin được cạnh dòng báo lỗi.
  const shown = isError ? null : result
  const active = shown?.byRule.filter((r) => r.spend > 0) ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cashback-soft text-cashback">
            <Coins aria-hidden className="h-4 w-4" />
          </span>
          Hoàn tiền ước tính kỳ này
        </h4>
        <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
          {rules.length > 0 ? 'Rule hoàn tiền' : 'Cài đặt hoàn tiền'}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Đang tính…</p>}
      {isError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
          Không tính được hoàn tiền.
          <Button size="sm" variant="outline" onClick={() => refetch()}>Thử lại</Button>
        </div>
      )}

      {shown && rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có rule hoàn tiền. Thêm rule để xem số tiền hoàn ước tính của thẻ này.
        </p>
      )}

      {shown && rules.length > 0 && (
        <>
          <p data-testid="cashback-total" className="text-3xl font-bold tracking-tight money text-cashback">
            {formatVND(shown.total)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">ước tính</span>
          </p>
          {shown.cardCap !== null && (
            <div className="space-y-1">
              <MeterBar
                percent={(shown.total / shown.cardCap) * 100}
                label="Đã dùng trần hoàn tiền của thẻ"
                fillClassName="bg-cashback-strong"
              />
              <p className="text-xs text-muted-foreground money">
                {formatVND(shown.total)} / trần thẻ {formatVND(shown.cardCap)}
              </p>
            </div>
          )}
          {shown.cardCapped && shown.cardCap !== null && (
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1 text-xs">Đã chạm trần thẻ</Badge>
              {formatVND(shown.cardCap)}/kỳ (tổng các rule trước khi cắt: {formatVND(shown.uncappedTotal)})
            </p>
          )}
          {active.length > 0 ? (
            <ul className="space-y-3">{active.map((r) => <RuleLine key={r.ruleId} r={r} />)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có giao dịch chi nào thuộc rule trong kỳ này.</p>
          )}
          {shown.unmatchedSpend > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatVND(shown.unmatchedSpend)} chi tiêu không thuộc rule nào (chưa có rule mặc định) nên không được hoàn.
            </p>
          )}
        </>
      )}

      <CashbackRulesEditor card={card} open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  )
}
