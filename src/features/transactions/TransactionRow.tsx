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
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors dark:border-slate-700 dark:bg-slate-900">
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
          <p className="font-medium text-sm text-foreground truncate">
            {tx.merchantName ?? tx.description}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDisplayDate(tx.transactionDate)}
          </p>
        </div>
      </div>

      {/* Right: amount */}
      <span
        className={`shrink-0 font-semibold text-sm ml-4 tabular-nums ${
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
