import { Badge } from '@/components/ui/badge'
import { useUpdateTransactionMcc } from '@/hooks/useUpdateTransactionMcc'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import { MCC_OPTIONS, formatMcc, getMccLabel, suggestMcc } from '@/utils/mcc'
import { ShoppingBag } from 'lucide-react'
import type { CreditCardTransaction } from '@/types/creditCard'

interface CreditCardTransactionRowProps {
  transaction: CreditCardTransaction
}

export function CreditCardTransactionRow({ transaction: tx }: CreditCardTransactionRowProps) {
  const isPending = tx.status === 'pending'
  const updateMcc = useUpdateTransactionMcc()

  // Không dùng `disabled` khi đang lưu: control đang focus bị disable thì focus rơi về <body>,
  // người dùng bàn phím mất vị trí. Chặn ngay trong handler, báo trạng thái bằng aria-busy.
  const setMcc = (mcc: string | null) => {
    if (updateMcc.isPending) return
    updateMcc.mutate({ txId: tx.id, mcc })
  }
  const merchantLabel = tx.merchantName || tx.description || 'giao dịch'
  // Gợi ý chỉ hiện khi chưa phân loại và KHÔNG tự lưu: khớp từ khoá có thể sai (vd GrabFood).
  const suggestion = tx.mcc ? null : suggestMcc(tx.merchantName)
  // MCC lạ (đặt từ nơi khác, không nằm trong danh sách rút gọn) vẫn phải hiển thị được.
  const hasUnknownMcc = Boolean(tx.mcc) && getMccLabel(tx.mcc) === undefined

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors dark:border-slate-700 dark:bg-slate-900">
      {/* Left: icon + merchant + date + status badge */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
          <ShoppingBag className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{tx.merchantName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-muted-foreground">{formatDisplayDate(tx.transactionDate)}</p>
            <Badge
              variant={isPending ? 'secondary' : 'default'}
              className="text-xs px-1.5 py-0"
            >
              {isPending ? 'Chờ xử lý' : 'Đã hạch toán'}
            </Badge>
          </div>
          {/* MCC do user tự gán — dùng để tính hoàn tiền theo rule của thẻ */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <select
              aria-label={`Phân loại MCC cho ${merchantLabel}`}
              aria-busy={updateMcc.isPending}
              value={tx.mcc ?? ''}
              onChange={(e) => setMcc(e.target.value || null)}
              className="border-input h-7 max-w-[15rem] rounded-md border bg-transparent px-2 text-xs aria-busy:opacity-60"
            >
              <option value="">Chưa phân loại MCC</option>
              {hasUnknownMcc && <option value={tx.mcc}>{tx.mcc}</option>}
              {MCC_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{formatMcc(o.code)}</option>
              ))}
            </select>
            {suggestion && (
              <button
                type="button"
                aria-busy={updateMcc.isPending}
                onClick={() => setMcc(suggestion)}
                className="text-xs text-primary underline-offset-2 hover:underline aria-busy:opacity-50"
              >
                Gợi ý: {formatMcc(suggestion)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: amount (always expense for credit card) */}
      <span className="shrink-0 font-semibold text-sm ml-4 tabular-nums text-red-600 dark:text-red-400">
        –{formatVND(Math.abs(tx.amount))}
      </span>
    </div>
  )
}
