import { Receipt, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/empty-state/EmptyState'

interface TransactionEmptyStateProps {
  hasFilters?: boolean
}

export function TransactionEmptyState({ hasFilters = false }: TransactionEmptyStateProps) {
  return hasFilters ? (
    <EmptyState icon={SearchX} title="Không có giao dịch phù hợp" description="Thử điều chỉnh bộ lọc hoặc xóa bộ lọc." />
  ) : (
    <EmptyState icon={Receipt} title="Chưa có giao dịch" description="Giao dịch sẽ xuất hiện ở đây." />
  )
}
