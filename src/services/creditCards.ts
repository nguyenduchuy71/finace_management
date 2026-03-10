import { apiClient } from './apiClient'
import { CreditCardSchema, CreditCardTransactionSchema } from '@/types/creditCard'
import { PaginatedResponseSchema } from '@/types/api'
import type { TransactionFilters } from './accounts'

const PaginatedCreditCardSchema = PaginatedResponseSchema(CreditCardSchema)
const PaginatedCreditCardTransactionSchema = PaginatedResponseSchema(CreditCardTransactionSchema)

export async function getCreditCards() {
  const response = await apiClient.get('/credit-cards')
  return PaginatedCreditCardSchema.parse(response.data)
}

export async function getCreditCardTransactions(
  cardId: string,
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters
) {
  const response = await apiClient.get(
    `/credit-cards/${cardId}/transactions`,
    {
      params: {
        ...(cursor && { cursor }),
        limit,
        ...(filters?.search && { search: filters.search }),
        ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters?.dateTo && { dateTo: filters.dateTo }),
        ...(filters?.txType && filters.txType !== 'all' && { txType: filters.txType }),
        ...(filters?.category && filters.category !== 'all' && { category: filters.category }),
      },
    }
  )
  return PaginatedCreditCardTransactionSchema.parse(response.data)
}
