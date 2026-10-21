import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Cùng bố cục CategoryChart (donut 220px + danh sách) — không nhảy layout khi chunk recharts tải xong. */
export function CategoryChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
        <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      </CardContent>
    </Card>
  )
}
