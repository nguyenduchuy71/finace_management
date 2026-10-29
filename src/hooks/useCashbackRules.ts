import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listCashbackRules, createCashbackRule, updateCashbackRule, deleteCashbackRule, setCardCashbackCap,
} from '@/services/cashbackRules'
import type { CashbackRuleInput } from '@/types/cashback'
import { QK } from './query-keys'

export function useCashbackRules(cardId: string) {
  return useQuery({
    queryKey: [...QK.cashbackRules, cardId],
    queryFn: () => listCashbackRules(cardId),
  })
}

/** Đổi rule làm đổi số hoàn tiền ước tính: useCycleCashback tính lại từ danh sách rule mới. */
function useInvalidateCashback(cardId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: [...QK.cashbackRules, cardId] })
}

/** Thêm (ruleId = null) hoặc sửa một rule. */
export function useSaveCashbackRule(cardId: string) {
  const invalidate = useInvalidateCashback(cardId)
  return useMutation({
    mutationFn: ({ ruleId, values }: { ruleId: string | null; values: CashbackRuleInput }) =>
      ruleId ? updateCashbackRule(cardId, ruleId, values) : createCashbackRule(cardId, values),
    onSuccess: async (_rule, { ruleId }) => {
      await invalidate()
      toast.success(ruleId ? 'Đã cập nhật rule' : 'Đã thêm rule')
    },
  })
}

export function useDeleteCashbackRule(cardId: string) {
  const invalidate = useInvalidateCashback(cardId)
  return useMutation({
    mutationFn: (ruleId: string) => deleteCashbackRule(ruleId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Đã xoá rule')
    },
  })
}

/** Trần tổng của thẻ nằm trên credit_cards: đổi xong phải làm mới danh sách thẻ để Summary tính lại. */
export function useSetCardCashbackCap(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cap: number | null) => setCardCashbackCap(cardId, cap),
    onSuccess: async (_void, cap) => {
      await qc.invalidateQueries({ queryKey: QK.creditCards })
      toast.success(cap === null ? 'Đã bỏ trần hoàn tiền của thẻ' : 'Đã lưu trần hoàn tiền của thẻ')
    },
  })
}
