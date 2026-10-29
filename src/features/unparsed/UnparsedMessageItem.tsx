import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDisplayDateTime } from '@/utils/dates'
import type { SuggestedKind, UnparsedMessage } from '@/types/unparsed'

const SUGGESTED_LABEL: Record<SuggestedKind, string> = {
  transaction: 'Có vẻ là giao dịch',
  card_reminder: 'Nhắc thanh toán thẻ',
  promo: 'Quảng cáo',
  unknown: 'Chưa rõ',
}

/** Màu gợi ý theo token: giao dịch = brand, nhắc thẻ = nội bộ, quảng cáo/chưa rõ = trung tính. */
const SUGGESTED_CLASS: Record<SuggestedKind, string> = {
  transaction: 'border-transparent bg-primary/10 text-primary',
  card_reminder: 'border-transparent bg-internal-soft text-internal',
  promo: 'border-transparent bg-muted text-muted-foreground',
  unknown: 'border-transparent bg-muted text-muted-foreground',
}

interface Props {
  message: UnparsedMessage
  disabled: boolean
  onRecord: () => void
  onMark: (kind: 'card_reminder' | 'promo') => void
}

/** Một tin chưa phân loại: nguyên văn + gợi ý của máy + các cách xử lý. */
export function UnparsedMessageItem({ message, disabled, onRecord, onMark }: Props) {
  const suggested = message.suggestedKind
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={message.receivedAt}>{formatDisplayDateTime(message.receivedAt)}</time>
        {message.source && <span>· {message.source}</span>}
        {suggested && (
          <Badge variant="outline" className={SUGGESTED_CLASS[suggested]}>{SUGGESTED_LABEL[suggested]}</Badge>
        )}
      </div>
      {/* whitespace-pre-line: giữ xuống dòng của thông báo gốc (mỗi field một dòng). */}
      <p className="line-clamp-4 whitespace-pre-line break-words rounded-lg bg-muted/60 p-3 text-sm">{message.rawText}</p>
      {message.onHold ? (
        // Tin giữ vì hết credit: chỉ hệ thống ghi được — tự động ngay khi số dư được cộng (nạp tiền hoặc quản trị
        // viên điều chỉnh). Ẩn nút phân loại.
        <p role="status" className="rounded-lg border border-warning p-3 text-sm">
          <strong>Chờ nạp credit.</strong> Tin sẽ tự được ghi thành giao dịch ngay khi số dư credit của bạn được cộng.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRecord} disabled={disabled}>Ghi thành giao dịch</Button>
          <Button size="sm" variant="outline" onClick={() => onMark('card_reminder')} disabled={disabled}>
            Nhắc thanh toán thẻ
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMark('promo')} disabled={disabled}>
            Bỏ qua (quảng cáo)
          </Button>
        </div>
      )}
    </li>
  )
}
