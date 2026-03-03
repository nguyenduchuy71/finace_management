import { SearchX } from 'lucide-react'

interface TransactionEmptyStateProps {
  hasFilters?: boolean
}

export function TransactionEmptyState({ hasFilters = false }: TransactionEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
      <SearchX className="h-10 w-10 mb-3 opacity-40" />
      <p className="font-medium">
        {hasFilters ? 'Kh\u00f4ng c\u00f3 giao d\u1ecbch ph\u00f9 h\u1ee3p' : 'Ch\u01b0a c\u00f3 giao d\u1ecbch'}
      </p>
      <p className="text-sm mt-1">
        {hasFilters ? 'Th\u1eed \u0111i\u1ec1u ch\u1ec9nh b\u1ed9 l\u1ecdc ho\u1eb7c x\u00f3a b\u1ed9 l\u1ecdc.' : 'Giao d\u1ecbch s\u1ebd xu\u1ea5t hi\u1ec7n \u1edf \u0111\u00e2y.'}
      </p>
    </div>
  )
}
