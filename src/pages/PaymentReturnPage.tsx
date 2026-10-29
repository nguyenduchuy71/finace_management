import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { usePaymentOrder } from '@/hooks/usePayments'
import { getErrorMessage } from '@/services/api-errors'
import { formatVND } from '@/utils/currency'
import { PROVIDER_LABEL } from '@/types/payment'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Dòng trạng thái + biểu tượng; `role="status"` để đọc màn hình báo khi đổi trạng thái. */
function Notice({ icon: Icon, tone, title, children }: {
  icon: typeof Clock; tone: string; title: string; children?: React.ReactNode
}) {
  return (
    <div role="status" className="flex items-start gap-3">
      <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${tone}`} aria-hidden />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="body-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

/**
 * /payment/return?order=<id>: ví đưa user về đây. Trang này CHỈ hiển thị trạng thái đơn trong DB —
 * credit chỉ được cộng bởi IPN / đối soát ở server, nên mở trang với query bất kỳ không đổi được gì.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams()
  const raw = params.get('order')
  const orderId = raw && UUID_RE.test(raw) ? raw : null
  const { data: order, isPending, isError, error, timedOut } = usePaymentOrder(orderId)

  let body: React.ReactNode
  if (!orderId) {
    body = <Notice icon={XCircle} tone="text-expense" title="Liên kết không hợp lệ">Không tìm thấy mã đơn nạp credit.</Notice>
  } else if (isError) {
    body = <Notice icon={XCircle} tone="text-expense" title="Không tải được đơn">{getErrorMessage(error, 'Vui lòng tải lại trang.')}</Notice>
  } else if (isPending) {
    body = <p className="text-sm text-muted-foreground">Đang tải…</p>
  } else if (!order) {
    body = <Notice icon={XCircle} tone="text-expense" title="Không tìm thấy đơn">Đơn không tồn tại hoặc không thuộc tài khoản này.</Notice>
  } else if (order.status === 'paid') {
    body = (
      <Notice icon={CheckCircle2} tone="text-income" title="Đã nhận thanh toán">
        Đã cộng <span className="money font-medium">{order.credits}</span> credit ({PROVIDER_LABEL[order.provider]}, {formatVND(order.amountVnd)}).
      </Notice>
    )
  } else if (order.status === 'mismatch') {
    body = (
      <Notice icon={AlertTriangle} tone="text-warning" title="Cần hỗ trợ">
        Hệ thống nhận được thanh toán nhưng chưa khớp đơn (sai số tiền hoặc quá hạn). Credit chưa được cộng —
        vui lòng liên hệ hỗ trợ kèm mã đơn <code className="font-mono">{order.id}</code>.
      </Notice>
    )
  } else if (order.status === 'failed' || order.status === 'expired') {
    body = (
      <Notice icon={XCircle} tone="text-expense" title={order.status === 'expired' ? 'Đơn đã hết hạn' : 'Thanh toán thất bại'}>
        Chưa có khoản nào bị trừ cho đơn này. Bạn có thể tạo đơn mới trong Cài đặt.
      </Notice>
    )
  } else if (timedOut) {
    body = (
      <Notice icon={Clock} tone="text-muted-foreground" title="Chưa nhận được xác nhận">
        Nếu bạn đã thanh toán, credit sẽ được cộng khi ví xác nhận (có thể mất vài phút). Xem lại ở Cài đặt sau ít phút.
      </Notice>
    )
  } else {
    body = (
      <Notice icon={Clock} tone="text-muted-foreground" title="Đang chờ xác nhận thanh toán">
        Giữ trang này mở — trạng thái tự cập nhật. Đừng thanh toán lại.
      </Notice>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card className="p-6">{body}</Card>
      <Link to="/settings" className="text-sm underline">Về Cài đặt</Link>
    </div>
  )
}
