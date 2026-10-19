import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function RuleLine({ r }: { r: RuleCashback }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{r.mcc ? formatMcc(r.mcc) : DEFAULT_RULE_LABEL}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          chi {formatVND(r.spend)} · {r.ratePercent}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        {r.belowMin && (
          <Badge variant="secondary" className="text-xs">
            Chưa đạt ngưỡng {formatVND(r.minCycleSpend)}
          </Badge>
        )}
        {r.capped && <Badge variant="secondary" className="text-xs">Đã chạm trần</Badge>}
        <span className="font-semibold tabular-nums">{formatVND(r.cashback)}</span>
      </div>
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
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Hoàn tiền ước tính kỳ này</h4>
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
          <p data-testid="cashback-total" className="text-2xl font-bold tabular-nums">
            {formatVND(shown.total)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">ước tính</span>
          </p>
          {active.length > 0 ? (
            <ul className="space-y-1.5">{active.map((r) => <RuleLine key={r.ruleId} r={r} />)}</ul>
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
