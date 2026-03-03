import { Skeleton } from '@/components/ui/skeleton'

interface TransactionListSkeletonProps {
  count?: number
}

export function TransactionListSkeleton({ count = 5 }: TransactionListSkeletonProps) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between items-center border rounded-lg p-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
