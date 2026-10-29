import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getUnparsedCount, getUnparsedMessages, resolveUnparsed } from '@/services/unparsed-messages'
import { RESOLVE_KIND_LABEL, type ResolveKind, type ResolveTxInput } from '@/types/unparsed'
import { QK } from './query-keys'

const KEY = QK.unparsedMessages

export function useUnparsedMessages(includePromo: boolean) {
  return useQuery({
    queryKey: [...KEY, 'list', { includePromo }],
    queryFn: () => getUnparsedMessages(includePromo),
  })
}

/** Badge số tin cần xử lý trên tab. */
export function useUnparsedCount() {
  return useQuery({
    queryKey: [...KEY, 'count'],
    queryFn: getUnparsedCount,
  })
}

export interface ResolveVars {
  messageId: string
  kind: ResolveKind
  tx?: ResolveTxInput
}

/**
 * Xử lý tin. Tạo giao dịch thì mọi thứ dẫn xuất từ giao dịch phải tải lại: danh sách
 * TK/thẻ, dashboard, chi tiêu chu kỳ (hoàn tiền ước tính) — và số dư credit (ghi giao dịch trừ 1 credit).
 */
export function useResolveUnparsed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, kind, tx }: ResolveVars) => resolveUnparsed(messageId, kind, tx),
    onSuccess: async (txId, { kind }) => {
      const keys = [KEY, ...(txId
        ? [QK.transactions, QK.creditCardTransactions, QK.dashboardStats, QK.cardCycleExpenses, QK.credits]
        : [])]
      await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })))
      toast.success(txId ? `Đã ghi giao dịch (${RESOLVE_KIND_LABEL[kind]})` : `Đã đánh dấu: ${RESOLVE_KIND_LABEL[kind]}`)
    },
    // Tin có thể đã được xử lý ở tab/thiết bị khác (invalid_request) hoặc bị xoá (not_found): tải lại
    // hộp để tin đó biến mất thay vì user bấm mãi vẫn lỗi. Số dư cũng tải lại: hết credit (insufficient_credit)
    // thường do số dư hiển thị đã cũ.
    onError: () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: QK.credits })]),
  })
}
