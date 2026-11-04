import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateCardTransaction } from '@/services/creditCards'
import type { CardTransactionPatch } from '@/types/card-transaction-patch'
import type { ApiError } from '@/types/api'
import { QK } from './query-keys'

/**
 * Sửa một giao dịch thẻ. Số tiền / ngày / loại / MCC đều ảnh hưởng danh sách, tổng quan và hoàn tiền
 * ước tính của chu kỳ nên tải lại cả ba. Không trả promise ở onSuccess: dialog đóng ngay khi lưu xong,
 * đồng bộ lại chạy nền (giống useUpdateTransactionMcc).
 */
export function useUpdateCardTransaction() {
  const qc = useQueryClient()
  return useMutation<void, ApiError, { txId: string; patch: CardTransactionPatch }>({
    mutationFn: ({ txId, patch }) => updateCardTransaction(txId, patch),
    onSuccess: () => {
      for (const queryKey of [QK.creditCardTransactions, QK.cardCycleExpenses, QK.dashboardStats]) {
        void qc.invalidateQueries({ queryKey })
      }
      toast.success('Đã lưu giao dịch')
    },
  })
}
