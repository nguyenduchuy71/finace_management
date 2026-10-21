import { Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatVND } from '@/utils/currency'
import type { CreditCard } from '@/types/creditCard'
import { CARD_TYPE_LABEL, getBankBrand } from './bank-branding'

/**
 * Thẻ đang chọn vẽ như thẻ vật lý (tỉ lệ ISO ID-1 ≈ 1.586:1), gradient theo tông ngân hàng.
 * Chỉ hiện 4 ký tự cuối của `cardNumber` (DB lưu dạng `****xxxx`) — không bao giờ có số thẻ đầy đủ.
 */
export function CardVisual({ card }: { card: CreditCard }) {
  const brand = getBankBrand(card.bankName)
  const last4 = card.cardNumber.slice(-4)

  return (
    <div
      role="img"
      aria-label={`Thẻ ${card.cardName}, ${card.bankName}, đuôi ${last4}`}
      className={cn(
        'relative isolate aspect-[1.586] w-full max-w-[340px] overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg',
        brand.gradient,
      )}
    >
      {/* Ánh sáng chéo + vòng tròn mờ: chiều sâu thị giác, không mang thông tin */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-tr from-white/0 via-white/10 to-white/0" />
      <div aria-hidden className="absolute -right-10 -top-12 -z-10 h-40 w-40 rounded-full bg-white/10" />

      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-md bg-white/15 px-2 py-1 text-xs font-bold tracking-wide">{brand.short}</span>
          <Wifi aria-hidden className="h-5 w-5 rotate-90 opacity-80" />
        </div>

        <div aria-hidden className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />

        <div className="space-y-1">
          <p aria-hidden className="money text-lg font-semibold tracking-[0.2em]">•••• •••• •••• {last4}</p>
          <div className="flex items-end justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium">{card.cardName}</p>
              {card.creditLimit > 0 && (
                <p className="money opacity-80">Hạn mức {formatVND(card.creditLimit)}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold italic">{CARD_TYPE_LABEL[card.cardType] ?? card.cardType}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
