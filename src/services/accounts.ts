import { supabase } from '@/lib/supabase'
import type { BankAccount, Transaction } from '@/types/account'
import type { PaginatedResponse } from '@/types/api'
import { mapAccount, mapTransaction, type AccountRow } from './mappers'
import { toApiError, countRows } from './api-errors'
import { fetchTransactionPage } from './transaction-fetch'
import { TX_PAGE_SIZE, type TransactionFilters } from './transactionQuery'

export async function getAccounts(): Promise<PaginatedResponse<BankAccount>> {
  // RLS đã lọc theo user đang đăng nhập — không cần .eq('user_id', ...)
  const { data, error, count } = await supabase
    .from('accounts')
    .select('*', { count: 'exact' })
    .order('bank_name')

  if (error) throw toApiError(error)
  return {
    data: ((data ?? []) as AccountRow[]).map(mapAccount),
    nextCursor: null,
    total: count ?? 0,
  }
}

export function getTransactions(
  accountId: string,
  cursor?: string,
  limit = TX_PAGE_SIZE,
  filters?: TransactionFilters
): Promise<PaginatedResponse<Transaction>> {
  return fetchTransactionPage((q) => q.eq('account_id', accountId), mapTransaction, { cursor, limit, filters })
}

/**
 * Đếm giao dịch chưa resolve được thẻ/tài khoản (account_id và card_id đều null).
 *
 * VÌ SAO CẦN: mọi query giao dịch đều lọc theo account_id/card_id, nên row chưa
 * link KHÔNG BAO GIỜ hiện trong danh sách. Nhưng RPC dashboard lại ĐẾM chúng
 * (không lọc theo FK) -> tổng thu/chi trên dashboard không khớp với danh sách,
 * và user không có cách nào tìm ra giao dịch bị thiếu.
 *
 * Thường do chưa seed `accounts`/`credit_cards`, hoặc `account_number`/`card_number`
 * không kết thúc đúng `account_ref` mà parser bắt được (xem edge function).
 * Trả về > 0 nghĩa là cần bổ sung/sửa dữ liệu thẻ.
 */
export async function getUnlinkedCount(): Promise<number> {
  return countRows(
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .is('account_id', null)
      .is('card_id', null),
  )
}
