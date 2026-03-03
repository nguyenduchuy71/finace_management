import { Skeleton } from '@/components/ui/skeleton'

interface CreditCardTransactionListSkeletonProps {
  count?: number
}

export function CreditCardTransactionListSkeleton({ count = 5 }: CreditCardTransactionListSkeletonProps) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between items-center border rounded-lg p-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
