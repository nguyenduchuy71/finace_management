import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilterStore } from '@/stores/filterStore'

export function TransactionTypeFilter() {
  const txType = useFilterStore((s) => s.txType)
  const setTxType = useFilterStore((s) => s.setTxType)

  return (
    <Select value={txType} onValueChange={(v) => setTxType(v as typeof txType)}>
      <SelectTrigger className="w-[140px] min-h-[44px]">
        <SelectValue placeholder="Loại giao dịch" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tất cả</SelectItem>
        <SelectItem value="income">Thu nhập</SelectItem>
        <SelectItem value="expense">Chi tiêu</SelectItem>
      </SelectContent>
    </Select>
  )
}
