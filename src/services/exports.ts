import { apiClient } from './apiClient'
import { TransactionSchema } from '@/types/account'
import { CreditCardTransactionSchema } from '@/types/creditCard'
import { PaginatedResponseSchema } from '@/types/api'
import type { TransactionFilters } from './accounts'

const PaginatedTransactionSchema = PaginatedResponseSchema(TransactionSchema)
const PaginatedCreditCardSchema = PaginatedResponseSchema(CreditCardTransactionSchema)

/**
 * Fetch all transactions for a bank account or credit card with applied filters.
 * No pagination (no cursor, no limit) — exports fetch complete dataset.
 *
 * @param accountOrCardId Account ID (for bank transactions) or null (use cardId from filters)
 * @param filters Optional filters (dateFrom, dateTo, txType, category, search, cardId)
 * @returns Paginated response with all matching transactions
 */
export async function exportTransactions(
  accountOrCardId: string | null,
  filters?: TransactionFilters & { cardId?: string }
) {
  // Determine endpoint based on whether accountId or cardId is provided
  let endpoint: string

  if (accountOrCardId) {
    endpoint = `/accounts/${accountOrCardId}/transactions`
  } else if (filters?.cardId) {
    endpoint = `/credit-cards/${filters.cardId}/transactions`
  } else {
    throw new Error('Either accountOrCardId or filters.cardId must be provided')
  }

  // Build params object conditionally, excluding undefined and 'all' values
  const params: Record<string, string> = {}

  if (filters?.search) {
    params.search = filters.search
  }
  if (filters?.dateFrom) {
    params.dateFrom = filters.dateFrom
  }
  if (filters?.dateTo) {
    params.dateTo = filters.dateTo
  }
  if (filters?.txType && filters.txType !== 'all') {
    params.txType = filters.txType
  }
  if (filters?.category && filters.category !== 'all') {
    params.category = filters.category
  }

  // Fetch transactions without pagination
  const response = await apiClient.get(endpoint, { params })

  // Parse based on endpoint type
  const schema = accountOrCardId ? PaginatedTransactionSchema : PaginatedCreditCardSchema

  return schema.parse(response.data)
}
