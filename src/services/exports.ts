import type { CreditCardTransaction } from '@/types/creditCard'
import type { Transaction } from '@/types/account'
import type { PaginatedResponse } from '@/types/api'
import { mapTransaction, mapCreditCardTransaction } from './mappers'
import { fetchAllTransactions } from './transaction-fetch'
import type { TransactionFilters } from './transactionQuery'

/**
 * Lấy TOÀN BỘ giao dịch (đã áp filter) của 1 tài khoản để xuất CSV. Tự lật trang
 * (xem fetchAllTransactions) và báo lỗi thay vì cắt cụt khi vượt trần.
 */
export function exportAccountTransactions(
  accountId: string,
  filters?: TransactionFilters
): Promise<PaginatedResponse<Transaction>> {
  return fetchAllTransactions((q) => q.eq('account_id', accountId), mapTransaction, filters)
}

/** Như exportAccountTransactions nhưng cho 1 thẻ tín dụng. */
export function exportCardTransactions(
  cardId: string,
  filters?: TransactionFilters
): Promise<PaginatedResponse<CreditCardTransaction>> {
  return fetchAllTransactions((q) => q.eq('card_id', cardId), mapCreditCardTransaction, filters)
}

/**
 * Điểm vào cho nút xuất CSV (UI chỉ biết "đang chọn TK hay thẻ"): `accountOrCardId` là TK,
 * hoặc null thì dùng `filters.cardId`.
 */
export async function exportTransactions(
  accountOrCardId: string | null,
  filters?: TransactionFilters & { cardId?: string }
): Promise<PaginatedResponse<Transaction | CreditCardTransaction>> {
  if (accountOrCardId) return exportAccountTransactions(accountOrCardId, filters)
  if (filters?.cardId) return exportCardTransactions(filters.cardId, filters)
  throw new Error('Either accountOrCardId or filters.cardId must be provided')
}
