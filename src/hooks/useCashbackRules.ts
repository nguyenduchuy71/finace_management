import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listCashbackRules, createCashbackRule, updateCashbackRule, deleteCashbackRule,
} from '@/services/cashbackRules'
import type { CashbackFormValues } from '@/types/cashback-form'

export function useCashbackRules(cardId: string) {
  return useQuery({
    queryKey: ['cashbackRules', cardId],
    queryFn: () => listCashbackRules(cardId),
  })
}

/** Đổi rule làm đổi số hoàn tiền ước tính: useCycleCashback tính lại từ danh sách rule mới. */
function useInvalidateCashback(cardId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['cashbackRules', cardId] })
}

/** Thêm (ruleId = null) hoặc sửa một rule. */
export function useSaveCashbackRule(cardId: string) {
  const invalidate = useInvalidateCashback(cardId)
  return useMutation({
    mutationFn: ({ ruleId, values }: { ruleId: string | null; values: CashbackFormValues }) =>
      ruleId ? updateCashbackRule(ruleId, values) : createCashbackRule(cardId, values),
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
