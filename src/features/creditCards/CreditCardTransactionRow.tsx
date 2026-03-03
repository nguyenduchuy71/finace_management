import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import { ShoppingBag } from 'lucide-react'
import type { CreditCardTransaction } from '@/types/creditCard'

interface CreditCardTransactionRowProps {
  transaction: CreditCardTransaction
}

export function CreditCardTransactionRow({ transaction: tx }: CreditCardTransactionRowProps) {
  const isPending = tx.status === 'pending'

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
        </div>
      </div>

      {/* Right: amount (always expense for credit card) */}
      <span className="shrink-0 font-semibold text-sm ml-4 tabular-nums text-red-600 dark:text-red-400">
        –{formatVND(Math.abs(tx.amount))}
      </span>
    </div>
  )
}
