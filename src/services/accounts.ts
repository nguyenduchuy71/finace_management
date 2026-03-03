import { apiClient } from './apiClient'
import { BankAccountSchema, TransactionSchema } from '@/types/account'
import { PaginatedResponseSchema } from '@/types/api'

const PaginatedTransactionSchema = PaginatedResponseSchema(TransactionSchema)
const AccountsResponseSchema = PaginatedResponseSchema(BankAccountSchema)

export async function getAccounts() {
  const response = await apiClient.get('/accounts')
  return AccountsResponseSchema.parse(response.data)
}

export interface TransactionFilters {
  search?: string
  dateFrom?: string | null
  dateTo?: string | null
  txType?: 'all' | 'income' | 'expense'
}

export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters
) {
  const response = await apiClient.get(
    `/accounts/${accountId}/transactions`,
    {
      params: {
        ...(cursor && { cursor }),
        limit,
        ...(filters?.search && { search: filters.search }),
        ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters?.dateTo && { dateTo: filters.dateTo }),
        ...(filters?.txType && filters.txType !== 'all' && { txType: filters.txType }),
      },
    }
  )
  return PaginatedTransactionSchema.parse(response.data)
}
