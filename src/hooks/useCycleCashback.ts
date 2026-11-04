import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCycleExpenses } from '@/services/cashbackRules'
import { computeCashback } from '@/utils/cashback'
import { useCashbackRules } from './useCashbackRules'
import { QK } from './query-keys'

/**
 * Hoàn tiền ước tính của một thẻ trong một chu kỳ: rule + giao dịch chi của chu kỳ.
 * Tính ở client khi đọc, không lưu: đổi rule hoặc đổi MCC thì kết quả cập nhật cho cả
 * giao dịch cũ, không có số liệu cũ nào bị lệch.
 */
export function useCycleCashback(
  cardId: string,
  cycle: { startISO: string; endISO: string },
  cardCap: number | null = null
) {
  const rules = useCashbackRules(cardId)
  const expenses = useQuery({
    queryKey: [...QK.cardCycleExpenses, cardId, cycle.startISO, cycle.endISO],
    queryFn: () => getCycleExpenses(cardId, cycle.startISO, cycle.endISO),
  })

  const result = useMemo(
    () => (rules.data && expenses.data ? computeCashback(rules.data, expenses.data, cardCap) : null),
    [rules.data, expenses.data, cardCap]
  )

  return {
    result,
    rules: rules.data ?? [],
    isLoading: rules.isLoading || expenses.isLoading,
    isError: rules.isError || expenses.isError,
    refetch: () => Promise.all([rules.refetch(), expenses.refetch()]),
  }
}
