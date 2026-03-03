import { apiClient } from './apiClient'
import { CreditCardSchema, CreditCardTransactionSchema } from '@/types/creditCard'
import { PaginatedResponseSchema } from '@/types/api'

const PaginatedCreditCardSchema = PaginatedResponseSchema(CreditCardSchema)
const PaginatedCCTransactionSchema = PaginatedResponseSchema(CreditCardTransactionSchema)

export async function getCreditCards() {
  const response = await apiClient.get('/credit-cards')
  return PaginatedCreditCardSchema.parse(response.data)
}

export async function getCreditCardTransactions(
  cardId: string,
  cursor?: string,
  limit = 20
) {
  const response = await apiClient.get(
    `/credit-cards/${cardId}/transactions`,
    { params: { ...(cursor && { cursor }), limit } }
  )
  return PaginatedCCTransactionSchema.parse(response.data)
}
