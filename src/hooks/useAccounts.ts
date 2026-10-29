import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@/services/accounts'
import { QK } from './query-keys'

export function useAccounts() {
  return useQuery({
    queryKey: QK.accounts,
    queryFn: getAccounts,
  })
}
