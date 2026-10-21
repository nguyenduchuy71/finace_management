import { Skeleton } from '@/components/ui/skeleton'

interface TransactionListSkeletonProps {
  count?: number
}

/** Cùng khung với TransactionList (tiêu đề ngày + khối dòng chia vạch) để không nhảy layout. */
export function TransactionListSkeleton({ count = 5 }: TransactionListSkeletonProps) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <div className="divide-y rounded-xl border bg-card">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
