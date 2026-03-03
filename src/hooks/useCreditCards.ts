import { useQuery } from '@tanstack/react-query'
import { getCreditCards } from '@/services/creditCards'

export function useCreditCards() {
  return useQuery({
    queryKey: ['creditCards'],
    queryFn: getCreditCards,
  })
}
