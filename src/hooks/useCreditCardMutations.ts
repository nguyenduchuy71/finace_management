import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCreditCard, updateCreditCard, deleteCreditCard, countCardTransactions,
} from '@/services/credit-card-mutations'
import { getUnlinkedCount } from '@/services/accounts'
import type { CardFormValues } from '@/types/credit-card-form'
import type { CreditCard } from '@/types/creditCard'
import { QK } from './query-keys'

/**
 * Sau khi đổi thẻ, mọi thứ dẫn xuất từ thẻ/giao dịch của thẻ phải tải lại: danh
 * sách thẻ, giao dịch của thẻ, và dashboard (xoá thẻ kéo theo xoá giao dịch).
 */
function useInvalidateCardData() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: QK.creditCards }),
      qc.invalidateQueries({ queryKey: QK.creditCardTransactions }),
      qc.invalidateQueries({ queryKey: QK.dashboardStats }),
      qc.invalidateQueries({ queryKey: QK.cashbackRules }),
      qc.invalidateQueries({ queryKey: QK.cardCycleExpenses }),
    ])
}

/**
 * `card_number` sai định dạng làm giao dịch không gắn được vào thẻ: không hiện trong
 * danh sách nhưng dashboard vẫn đếm. Không chặn được từ client (SMS đến sau), nên chỉ
 * cảnh báo khi đang có giao dịch chưa gắn thẻ/tài khoản nào.
 */
async function warnIfUnlinked() {
  try {
    const unlinked = await getUnlinkedCount()
    if (unlinked > 0) {
      toast.warning(
        `Có ${unlinked} giao dịch chưa gắn với thẻ hoặc tài khoản nào. ` +
        'Kiểm tra số thẻ (4 ký tự cuối phải đúng như trong SMS ngân hàng).'
      )
    }
  } catch {
    // Chỉ là cảnh báo phụ — lỗi đếm không được làm hỏng thao tác chính đã thành công.
  }
}

export function useCreateCreditCard() {
  const invalidate = useInvalidateCardData()
  return useMutation({
    mutationFn: (values: CardFormValues) => createCreditCard(values),
    onSuccess: async () => {
      await invalidate()
      toast.success('Đã thêm thẻ')
      void warnIfUnlinked()
    },
  })
}

export function useUpdateCreditCard(card: CreditCard | null) {
  const invalidate = useInvalidateCardData()
  return useMutation({
    mutationFn: (values: CardFormValues) => {
      if (!card) throw new Error('Không có thẻ để cập nhật')
      return updateCreditCard(card.id, values)
    },
    onSuccess: async (_updated, values) => {
      await invalidate()
      toast.success('Đã cập nhật thẻ')
      // Chỉ ngân hàng + số thẻ ảnh hưởng việc gắn giao dịch; đổi tên/hạn mức thì khỏi cảnh báo.
      if (card && (values.bankName !== card.bankName || values.cardNumber !== card.cardNumber)) {
        void warnIfUnlinked()
      }
    },
  })
}

export function useDeleteCreditCard() {
  const invalidate = useInvalidateCardData()
  return useMutation({
    mutationFn: (cardId: string) => deleteCreditCard(cardId),
    onSuccess: async (deletedTx) => {
      await invalidate()
      toast.success(`Đã xoá thẻ và ${deletedTx} giao dịch`)
    },
  })
}

/** Đếm giao dịch của thẻ để dialog xoá nói rõ sẽ mất bao nhiêu. */
export function useCardTransactionCount(cardId: string) {
  return useQuery({
    queryKey: [...QK.creditCardTxCount, cardId],
    queryFn: () => countCardTransactions(cardId),
    // Số liệu quyết định hành động không thể hoàn tác: luôn lấy mới khi mở dialog.
    staleTime: 0,
    gcTime: 0,
  })
}
