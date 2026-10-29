import { useQuery } from '@tanstack/react-query'
import { getCreditCards } from '@/services/creditCards'
import { QK } from './query-keys'

export function useCreditCards() {
  return useQuery({
    queryKey: QK.creditCards,
    queryFn: getCreditCards,
  })
}
