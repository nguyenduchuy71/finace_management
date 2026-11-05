import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useResolveOrder } from '@/hooks/useAdmin'
import { useDialogBusyGuard } from '@/hooks/useDialogBusyGuard'
import { getErrorMessage } from '@/services/api-errors'
import { ADMIN_REASON_LENGTH } from '@/types/admin'
import { ORDER_PROVIDER_LABEL, OrderTxIdSchema, type AdminOrder, type OrderResolution } from '@/types/admin-orders'
import { formatVND } from '@/utils/currency'

const COPY: Record<OrderResolution, { title: string; effect: (o: AdminOrder) => string; confirm: string; destructive: boolean }> = {
  mark_paid: {
    title: 'Đánh dấu đã thanh toán',
    effect: (o) =>
      `Cộng ${o.credits} credit cho ${o.email ?? 'user'} và phát lại tin đang treo. Chỉ làm khi đã đối chiếu tiền thật đã vào ` +
      `tài khoản (sao kê / cổng thanh toán). Mỗi đơn chỉ cộng một lần, không hoàn tác.`,
    confirm: 'Đánh dấu đã thanh toán',
    destructive: false,
  },
  mark_failed: {
    title: 'Đánh dấu thất bại',
    effect: () => 'Đóng đơn là thất bại, không cộng credit. Đơn vẫn có thể đánh dấu đã thanh toán sau nếu phát hiện tiền đã vào.',
    confirm: 'Đánh dấu thất bại',
    destructive: true,
  },
}

function Body({ order, option, setBusy, onDone }: {
  order: AdminOrder; option: OrderResolution; setBusy: (b: boolean) => void; onDone: () => void
}) {
  const resolve = useResolveOrder()
  const [reason, setReason] = useState('')
  const [txId, setTxId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[option]
  const { min, max } = ADMIN_REASON_LENGTH
  const length = reason.trim().length
  // Đơn chưa có mã giao dịch mà đánh dấu đã thanh toán: bắt buộc nhập mã của ví (server kiểm lại).
  const needsTxId = option === 'mark_paid' && !order.providerTxId
  const txIdOk = !needsTxId || OrderTxIdSchema.safeParse(txId).success
  const valid = length >= min && length <= max && txIdOk

  async function onConfirm() {
    if (!valid || resolve.isPending) return
    setError(null)
    setBusy(true)
    try {
      await resolve.mutateAsync({
        orderId: order.id, option, reason: reason.trim(), ...(needsTxId ? { providerTxId: txId.trim() } : {}),
      })
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Không xử lý được đơn. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.effect(order)}</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/50 p-3 text-xs">
        <dt className="text-muted-foreground">Cổng</dt><dd>{ORDER_PROVIDER_LABEL[order.provider]}</dd>
        <dt className="text-muted-foreground">Số tiền</dt><dd className="money">{formatVND(order.amountVnd)} · {order.credits} credit</dd>
        <dt className="text-muted-foreground">Mã đơn</dt><dd className="break-all">{order.providerOrderRef}</dd>
        <dt className="text-muted-foreground">Mã giao dịch</dt><dd className="break-all">{order.providerTxId ?? '—'}</dd>
      </dl>
      {needsTxId && (
        <div className="space-y-1 text-sm">
          <label htmlFor="order-tx-id" className="font-medium">Mã giao dịch của ví</label>
          <Input
            id="order-tx-id" value={txId} maxLength={100} autoComplete="off" aria-describedby="order-tx-id-hint"
            onChange={(e) => { setTxId(e.target.value); setError(null) }}
          />
          <p id="order-tx-id-hint" className="text-xs text-muted-foreground">
            Bắt buộc: mã MoMo transId / ZaloPay zp_trans_id lấy từ ví hoặc sao kê. Mỗi mã chỉ gắn được với một đơn.
          </p>
        </div>
      )}
      <div className="space-y-1 text-sm">
        <label htmlFor="order-reason" className="font-medium">Lý do (ghi vào nhật ký quản trị)</label>
        <Textarea
          id="order-reason" rows={3} value={reason} maxLength={max} aria-describedby="order-reason-hint"
          onChange={(e) => { setReason(e.target.value); setError(null) }}
        />
        <p id="order-reason-hint" className="text-xs text-muted-foreground">{min}–{max} ký tự. User không thấy lý do này.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={resolve.isPending}>Huỷ</Button>
        <Button
          type="button" variant={copy.destructive ? 'destructive' : 'default'}
          onClick={onConfirm} disabled={!valid || resolve.isPending}
        >
          {resolve.isPending ? 'Đang thực hiện…' : copy.confirm}
        </Button>
      </DialogFooter>
    </>
  )
}

export function AdminOrderDialog({ order, option, onClose }: {
  order: AdminOrder | null; option: OrderResolution | null; onClose: () => void
}) {
  const { setBusy, handleOpenChange } = useDialogBusyGuard((open) => { if (!open) onClose() })
  return (
    <Dialog open={order !== null && option !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {order && option && <Body key={`${order.id}:${option}`} order={order} option={option} setBusy={setBusy} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
