import { useQuery } from '@tanstack/react-query'
import { hasReceivedAnyMessage } from '@/services/setup-progress'
import { useAccounts } from './useAccounts'
import { useCreditCards } from './useCreditCards'
import { useApiKeys } from './useApiKeys'
import { QK } from './query-keys'

export interface SetupProgress {
  /** Có ít nhất 1 tài khoản ngân hàng hoặc thẻ (để giao dịch gắn được vào đâu đó). */
  hasSource: boolean
  /** Có API key còn hiệu lực cho Shortcut. */
  hasKey: boolean
  /** Shortcut đã gửi về ít nhất 1 tin. */
  hasData: boolean
}

/**
 * Tiến độ thiết lập cho user mới, suy ra từ dữ liệu sẵn có (không lưu cờ riêng ở DB).
 * `progress = null` khi chưa tải xong hoặc có lỗi — checklist không hiện thay vì hiện sai.
 */
export function useSetupProgress(): { progress: SetupProgress | null } {
  const accounts = useAccounts()
  const cards = useCreditCards()
  const keys = useApiKeys()
  const data = useQuery({ queryKey: QK.setupProgress, queryFn: hasReceivedAnyMessage })

  if (!accounts.data || !cards.data || !keys.data || data.data === undefined) return { progress: null }
  return {
    progress: {
      hasSource: accounts.data.data.length + cards.data.data.length > 0,
      hasKey: keys.data.some((k) => k.revokedAt === null),
      hasData: data.data,
    },
  }
}
