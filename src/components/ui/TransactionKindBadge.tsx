import { Badge } from './badge'
import { INTERNAL_TRANSFER_HINT, TRANSACTION_KIND_LABEL, type TransactionKind } from '@/types/account'

/**
 * Nhãn loại dòng tiền khác thường. Không hiện gì với 'normal' (đa số giao dịch).
 * "Nội bộ" giải thích vì sao giao dịch không được tính vào thu/chi ở Tổng quan.
 */
const KIND_CLASS: Record<Exclude<TransactionKind, 'normal'>, string> = {
  internal_transfer: 'border-transparent bg-internal-soft text-internal',
  cashback: 'border-transparent bg-cashback-soft text-cashback',
}

export function TransactionKindBadge({ kind }: { kind?: TransactionKind }) {
  if (!kind || kind === 'normal') return null
  return (
    <Badge
      variant="outline" className={`text-xs px-1.5 py-0 ${KIND_CLASS[kind]}`}
      title={kind === 'internal_transfer' ? INTERNAL_TRANSFER_HINT : undefined}
    >
      {TRANSACTION_KIND_LABEL[kind]}
    </Badge>
  )
}
