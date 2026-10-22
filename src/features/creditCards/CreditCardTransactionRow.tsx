import { Badge } from '@/components/ui/badge'
import { useUpdateTransactionMcc } from '@/hooks/useUpdateTransactionMcc'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import { formatMcc, suggestMcc } from '@/utils/mcc'
import { ArrowDownLeft, ShoppingBag } from 'lucide-react'
import type { CreditCard, CreditCardTransaction } from '@/types/creditCard'
import { BankLogo } from './BankLogo'
import { MccPicker } from './MccPicker'
import { TransactionKindBadge } from '@/components/ui/TransactionKindBadge'

interface CreditCardTransactionRowProps {
  transaction: CreditCardTransaction
  /** Mục "Nhiều thẻ": hiện thẻ của giao dịch (logo ngân hàng + tên + 4 số cuối). */
  card?: CreditCard
}

export function CreditCardTransactionRow({ transaction: tx, card }: CreditCardTransactionRowProps) {
  const isPending = tx.status === 'pending'
  // Tiền vào thẻ (trả nợ, hoàn tiền) — amount dương. Trước đây mọi dòng đều hiện '–' màu chi.
  const isCredit = tx.amount > 0
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

  return (
    <li className="flex gap-3 p-3 hover:bg-muted/50 transition-colors duration-200">
      {card ? (
        <BankLogo bankName={card.bankName} className="h-9 w-9" />
      ) : (
        <div className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${isCredit ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
          {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {/* Tên + số tiền cùng một hàng: số tiền không bao giờ tranh chỗ với ô chọn MCC bên dưới */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-sm text-foreground truncate">{tx.merchantName}</p>
          <span className={`shrink-0 font-semibold text-sm money ${isCredit ? 'text-income' : 'text-expense'}`}>
            {isCredit ? '+' : '–'}{formatVND(Math.abs(tx.amount))}
          </span>
        </div>
        {card && (
          <p className="text-xs text-muted-foreground truncate">
            {card.cardName} · ···· {card.cardNumber.slice(-4)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <p className="text-xs text-muted-foreground">{formatDisplayDate(tx.transactionDate)}</p>
          <TransactionKindBadge kind={tx.kind} />
          <Badge
            variant={isPending ? 'secondary' : 'default'}
            className="text-xs px-1.5 py-0"
          >
            {isPending ? 'Chờ xử lý' : 'Đã hạch toán'}
          </Badge>
        </div>
        {/* MCC do user tự gán — dùng để tính hoàn tiền theo rule của thẻ */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <MccPicker
            aria-label={`Phân loại MCC cho ${merchantLabel}`}
            aria-busy={updateMcc.isPending}
            value={tx.mcc ?? ''}
            onChange={(code) => setMcc(code || null)}
            noneLabel="Chưa phân loại MCC"
            className="max-w-[15rem] sm:w-60"
          />
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
    </li>
  )
}
