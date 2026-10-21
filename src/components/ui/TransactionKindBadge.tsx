import { Badge } from './badge'
import type { TransactionKind } from '@/types/account'

/**
 * Nhãn loại dòng tiền khác thường. Không hiện gì với 'normal' (đa số giao dịch).
 * "Nội bộ" giải thích vì sao giao dịch không được tính vào thu/chi ở Tổng quan.
 */
export function TransactionKindBadge({ kind }: { kind?: TransactionKind }) {
  if (kind === 'internal_transfer') {
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0" title="Chuyển giữa tài khoản/thẻ của bạn — không tính vào thu/chi">
        Nội bộ
      </Badge>
    )
  }
  if (kind === 'cashback') {
    return <Badge variant="outline" className="text-xs px-1.5 py-0">Cashback</Badge>
  }
  return null
}
