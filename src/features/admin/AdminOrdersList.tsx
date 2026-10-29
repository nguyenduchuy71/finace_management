import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { useAdminOrders } from '@/hooks/useAdmin'
import { useNow } from '@/hooks/useNow'
import {
  ORDER_PROVIDER_LABEL, ORDER_STATUS_LABEL, OrderProviderSchema, OrderStatusSchema, allowedResolutions, reconcileWarnings,
  type AdminOrder, type AdminOrderFilters, type OrderResolution, type OrderStatus,
} from '@/types/admin-orders'
import { formatVND } from '@/utils/currency'
import { formatDisplayDateTime } from '@/utils/dates'
import { AdminOrderDialog } from './AdminOrderDialog'

/** Màu theo token Ví Jade (không green/red): paid = thu, failed = chi, cần xử lý = warning. */
function StatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABEL[status]
  if (status === 'paid') return <Badge variant="outline" className="border-income bg-income-soft text-income">{label}</Badge>
  if (status === 'failed') return <Badge variant="outline" className="border-expense bg-expense-soft text-expense">{label}</Badge>
  if (status === 'mismatch') return <Badge variant="outline" className="border-warning">{label}</Badge>
  return <Badge variant="secondary">{label}</Badge>
}

const RESOLUTION_BUTTON: Record<OrderResolution, string> = { mark_paid: 'Đã thanh toán', mark_failed: 'Thất bại' }

/** Cảnh báo đối soát tự động (cron) — chỉ hiện khi có vấn đề. */
function ReconcileBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div role="alert" className="mt-3 rounded-md border border-warning bg-warning/15 p-3 text-sm">
      <p className="font-medium">Đối soát thanh toán tự động cần kiểm tra</p>
      <ul className="mt-1 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  )
}

/** Tối đa 100 đơn mới nhất theo bộ lọc (server cắt cứng, không phân trang). */
export function AdminOrdersList() {
  const [filters, setFilters] = useState<AdminOrderFilters>({ status: null, provider: null })
  const query = useAdminOrders(filters)
  const now = useNow()
  const list = query.data?.orders
  const [target, setTarget] = useState<{ order: AdminOrder; option: OrderResolution } | null>(null)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Đơn thanh toán {list && <span className="text-muted-foreground">({list.length})</span>}
        </h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-44">
            <label htmlFor="order-status" className="sr-only">Lọc theo trạng thái</label>
            <NativeSelect
              id="order-status" value={filters.status ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: OrderStatusSchema.safeParse(e.target.value).data ?? null }))}
            >
              <option value="">Mọi trạng thái</option>
              {OrderStatusSchema.options.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </NativeSelect>
          </div>
          <div className="min-w-0 flex-1 sm:w-36">
            <label htmlFor="order-provider" className="sr-only">Lọc theo cổng thanh toán</label>
            <NativeSelect
              id="order-provider" value={filters.provider ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, provider: OrderProviderSchema.safeParse(e.target.value).data ?? null }))}
            >
              <option value="">Mọi cổng</option>
              {OrderProviderSchema.options.map((p) => <option key={p} value={p}>{ORDER_PROVIDER_LABEL[p]}</option>)}
            </NativeSelect>
          </div>
        </div>
      </div>

      {query.isSuccess && <ReconcileBanner warnings={reconcileWarnings(query.data.reconcile, new Date(now).getTime())} />}

      <div className="mt-4">
        {query.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}{' '}
            <button type="button" className="underline" onClick={() => query.refetch()}>Thử lại</button>
          </p>
        )}
        {list?.length === 0 && <p className="text-sm text-muted-foreground">Không có đơn nào.</p>}
        {list && list.length > 0 && (
          <ul className="divide-y">
            {list.map((o) => (
              <li key={o.id} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{o.email ?? `${o.userId.slice(0, 8)}… (đã xoá)`}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {ORDER_PROVIDER_LABEL[o.provider]} · <span className="money">{formatVND(o.amountVnd)}</span> ·{' '}
                  <span className="money">{o.credits}</span> credit · tạo {formatDisplayDateTime(o.createdAt)}
                  {o.paidAt && ` · trả ${formatDisplayDateTime(o.paidAt)}`}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  {o.providerOrderRef}{o.providerTxId && ` · GD ${o.providerTxId}`}
                </p>
                {allowedResolutions(o.status).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allowedResolutions(o.status).map((option) => (
                      <Button
                        key={option} type="button" size="sm" className="min-h-[44px]"
                        variant={option === 'mark_failed' ? 'outline' : 'default'}
                        aria-label={`${RESOLUTION_BUTTON[option]}: đơn ${o.providerOrderRef}`}
                        onClick={() => setTarget({ order: o, option })}
                      >
                        {RESOLUTION_BUTTON[option]}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminOrderDialog order={target?.order ?? null} option={target?.option ?? null} onClose={() => setTarget(null)} />
    </Card>
  )
}
