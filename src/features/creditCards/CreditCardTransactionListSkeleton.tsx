import { Skeleton } from '@/components/ui/skeleton'

interface CreditCardTransactionListSkeletonProps {
  count?: number
}

/** Cùng khung với nhóm chu kỳ / nhóm ngày của danh sách thẻ để không nhảy layout. */
export function CreditCardTransactionListSkeleton({ count = 5 }: CreditCardTransactionListSkeletonProps) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-40" />
      <div className="divide-y rounded-xl border bg-card">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
