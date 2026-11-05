import { useQuery } from '@tanstack/react-query'
import { getCreditBalance, getCreditLedger, getHeldCount } from '@/services/credits'
import { QK } from './query-keys'

export function useCreditBalance() {
  return useQuery({ queryKey: [...QK.credits, 'balance'], queryFn: getCreditBalance })
}

export function useCreditLedger() {
  return useQuery({ queryKey: [...QK.credits, 'ledger'], queryFn: () => getCreditLedger() })
}

/** Số tin treo vì hết credit. */
export function useHeldCount() {
  return useQuery({ queryKey: [...QK.credits, 'held'], queryFn: getHeldCount })
}
