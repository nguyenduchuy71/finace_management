import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/stores/filterStore'

/** Lọc thu/chi. `className`: trong sheet bộ lọc (điện thoại) cần full bề ngang. */
export function TransactionTypeFilter({ className }: { className?: string }) {
  const txType = useFilterStore((s) => s.txType)
  const setTxType = useFilterStore((s) => s.setTxType)

  return (
    <Select value={txType} onValueChange={(v) => setTxType(v as typeof txType)}>
      <SelectTrigger aria-label="Loại giao dịch" className={cn('w-[140px] min-h-[44px]', className)}>
        <SelectValue placeholder="Loại giao dịch" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Thu &amp; chi</SelectItem>
        <SelectItem value="income">Thu nhập</SelectItem>
        <SelectItem value="expense">Chi tiêu</SelectItem>
      </SelectContent>
    </Select>
  )
}
