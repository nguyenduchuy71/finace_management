import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import { useCategoryOverrideStore } from '@/stores/categoryOverrideStore'
import { classifyTransaction, getCategoryLabel, CATEGORY_TAXONOMY } from '@/utils/categories'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Transaction } from '@/types/account'
import type { Category } from '@/types/categories'

interface TransactionRowProps {
  transaction: Transaction
}

export function TransactionRow({ transaction: tx }: TransactionRowProps) {
  const isIncome = tx.type === 'income'

  // Subscribe to overrides so the badge re-renders when user changes a category
  const overrides = useCategoryOverrideStore((s) => s.overrides)
  const effectiveCategory = useMemo(() => {
    if (tx.type === 'income') return null // No category for income
    const serverCategory = (tx.category as Category) || classifyTransaction(tx.merchantName)
    return overrides.get(tx.id) ?? serverCategory
  }, [tx.id, tx.category, tx.merchantName, tx.type, overrides])

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
        <div className="min-w-0 flex-1">
          {/* heading-label: text-sm font-medium leading-snug for merchant name */}
          <p className="heading-label text-foreground truncate">
            {tx.merchantName ?? tx.description}
          </p>
          {/* body-sm: text-sm font-normal leading-relaxed for date */}
          <p className="body-sm text-muted-foreground mt-0.5 !leading-none">
            {formatDisplayDate(tx.transactionDate)}
          </p>
          {/* Category badge for expense transactions */}
          {effectiveCategory && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="mt-1">
                  <CategoryBadge category={effectiveCategory} className="cursor-pointer" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2">
                <div className="flex flex-col gap-1">
                  {Object.keys(CATEGORY_TAXONOMY).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => useCategoryOverrideStore.getState().setOverride(tx.id, cat as Category)}
                      className="text-left text-sm p-2 rounded hover:bg-accent transition-colors duration-200"
                    >
                      {getCategoryLabel(cat as Category)}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
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
