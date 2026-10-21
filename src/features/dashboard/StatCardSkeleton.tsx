import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/** `tall`: ô hero Dòng tiền ròng (2 hàng trên lg) — giữ đúng chiều cao để không nhảy layout. */
export function StatCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <Card className={tall ? 'h-full min-h-[240px]' : 'h-full min-h-[140px]'}>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className={tall ? 'h-10 w-52' : 'h-8 w-36'} />
        <Skeleton className="h-3 w-20" />
        {tall && <Skeleton className="mt-4 h-2 w-full" />}
      </CardContent>
    </Card>
  )
}
