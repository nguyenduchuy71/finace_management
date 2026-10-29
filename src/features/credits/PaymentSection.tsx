import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { BuyCreditsDialog } from './BuyCreditsDialog'
import { PaymentOrderList } from './PaymentOrderList'

/** Trang Cài đặt: nạp credit qua MoMo / ZaloPay + lịch sử đơn. */
export function PaymentSection() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Nạp credit</h2>
            <p className="body-sm text-muted-foreground">Thanh toán qua ví MoMo hoặc ZaloPay, credit cộng tự động.</p>
          </div>
        </div>
        <BuyCreditsDialog />
      </div>
      <div className="mt-4"><PaymentOrderList /></div>
    </Card>
  )
}
