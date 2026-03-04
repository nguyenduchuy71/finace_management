import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import type { Transaction } from '@/types/account'

interface TransactionRowProps {
  transaction: Transaction
}

export function TransactionRow({ transaction: tx }: TransactionRowProps) {
  const isIncome = tx.type === 'income'

  return (
    <div className="flex items-center justify-between section-padding-x py-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900">
      {/* Left: icon + description + date */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${
            isIncome
              ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
          }`}
        >
          {isIncome ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          {/* heading-label: text-sm font-medium leading-snug for merchant name */}
          <p className="heading-label text-foreground truncate">
            {tx.merchantName ?? tx.description}
          </p>
          {/* body-sm: text-sm font-normal leading-relaxed for date */}
          <p className="body-sm text-muted-foreground mt-0.5 !leading-none">
            {formatDisplayDate(tx.transactionDate)}
          </p>
        </div>
      </div>

      {/* Right: amount — heading-label weight with tabular nums for alignment */}
      <span
        className={`shrink-0 heading-label ml-4 tabular-nums ${
          isIncome
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {isIncome ? '+' : '–'}{formatVND(Math.abs(tx.amount))}
      </span>
    </div>
  )
}
