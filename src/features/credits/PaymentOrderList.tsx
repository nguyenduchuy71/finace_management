import { Link } from 'react-router-dom'
import { usePaymentOrders } from '@/hooks/usePayments'
import { getErrorMessage } from '@/services/api-errors'
import { formatVND } from '@/utils/currency'
import { formatDisplayDateTime } from '@/utils/dates'
import { ORDER_STATUS_LABEL, PAYMENT_ORDER_LIMIT, PROVIDER_LABEL, type OrderStatus } from '@/types/payment'

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'text-muted-foreground',
  paid: 'text-income',
  expired: 'text-muted-foreground',
  failed: 'text-expense',
  mismatch: 'text-expense',
}

/** Lịch sử 20 đơn nạp gần nhất. Đơn đang chờ có link tới trang theo dõi (không thanh toán lại — đơn cũ có thể đã trả). */
export function PaymentOrderList() {
  const orders = usePaymentOrders()
  if (orders.isPending) return <p className="text-sm text-muted-foreground">Đang tải…</p>
  if (orders.isError) return <p role="alert" className="text-sm text-destructive">{getErrorMessage(orders.error, 'Không tải được lịch sử nạp.')}</p>
  if (orders.data.length === 0) return <p className="text-sm text-muted-foreground">Chưa có đơn nạp nào.</p>
  return (
    <>
      <h3 className="pt-2 text-sm font-medium">Đơn nạp ({PAYMENT_ORDER_LIMIT} đơn gần nhất)</h3>
      <ul className="divide-y text-sm">
        {orders.data.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 py-1.5">
            <span>
              {PROVIDER_LABEL[o.provider]} · <span className="money">{formatVND(o.amountVnd)}</span> → <span className="money">{o.credits}</span> credit
              <time dateTime={o.createdAt} className="ml-2 text-xs text-muted-foreground">{formatDisplayDateTime(o.createdAt)}</time>
            </span>
            <span className={STATUS_CLASS[o.status]}>
              {o.status === 'pending'
                ? <Link to={`/payment/return?order=${o.id}`} className="underline">{ORDER_STATUS_LABEL[o.status]}</Link>
                : ORDER_STATUS_LABEL[o.status]}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
