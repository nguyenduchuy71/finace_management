import { formatVND } from '@/utils/currency'

interface SourceSubtotalsProps {
  bankAmount: number
  ccAmount: number
  variant: 'income' | 'expense'
}

export function SourceSubtotals({ bankAmount, ccAmount, variant }: SourceSubtotalsProps) {
  const isIncome = variant === 'income'
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Ngân hàng: <span className="font-medium text-foreground">{formatVND(bankAmount)}</span></span>
      {!isIncome && (
        <span>Thẻ tín dụng: <span className="font-medium text-foreground">{formatVND(ccAmount)}</span></span>
      )}
    </div>
  )
}
