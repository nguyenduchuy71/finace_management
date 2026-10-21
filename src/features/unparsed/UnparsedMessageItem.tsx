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
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={message.receivedAt}>{formatDisplayDateTime(message.receivedAt)}</time>
        {message.source && <span>· {message.source}</span>}
        {suggested && (
          <Badge variant={suggested === 'transaction' ? 'default' : 'secondary'}>{SUGGESTED_LABEL[suggested]}</Badge>
        )}
      </div>
      {/* whitespace-pre-line: giữ xuống dòng của thông báo gốc (mỗi field một dòng). */}
      <p className="line-clamp-4 whitespace-pre-line break-words text-sm">{message.rawText}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRecord} disabled={disabled}>Ghi thành giao dịch</Button>
        <Button size="sm" variant="outline" onClick={() => onMark('card_reminder')} disabled={disabled}>
          Nhắc thanh toán thẻ
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onMark('promo')} disabled={disabled}>
          Bỏ qua (quảng cáo)
        </Button>
      </div>
    </li>
  )
}
