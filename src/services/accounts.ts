import { apiClient } from './apiClient'
import { BankAccountSchema, TransactionSchema } from '@/types/account'
import { PaginatedResponseSchema } from '@/types/api'

const PaginatedTransactionSchema = PaginatedResponseSchema(TransactionSchema)
const AccountsResponseSchema = PaginatedResponseSchema(BankAccountSchema)

export async function getAccounts() {
  const response = await apiClient.get('/accounts')
  // Zod parse throws ZodError if API shape doesn't match schema
  return AccountsResponseSchema.parse(response.data)
}

export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20
) {
  const response = await apiClient.get(
    `/accounts/${accountId}/transactions`,
    { params: { ...(cursor && { cursor }), limit } }
  )
  return PaginatedTransactionSchema.parse(response.data)
}
