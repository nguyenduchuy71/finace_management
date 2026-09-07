import { supabase } from '@/lib/supabase'
import {
  mapAccount, mapTransaction, toApiError, encodeCursor,
  type AccountRow, type TransactionRow,
} from './mappers'
import {
  applyTransactionFilters, paginate, totalForPage, countOption, TX_COLUMNS,
  type TransactionFilters,
} from './transactionQuery'

// Re-export để không phá import cũ ở creditCards.ts và các hook
export type { TransactionFilters }

export async function getAccounts() {
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

export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters
) {
  const base = supabase
    .from('transactions')
    .select(TX_COLUMNS, countOption(cursor))
    .eq('account_id', accountId)

  const { data, error, count } = await applyTransactionFilters(base, cursor, limit, filters)
  if (error) throw toApiError(error)

  const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], limit)
  return {
    data: rows.map(mapTransaction),
    nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    total: totalForPage(count, cursor),
  }
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
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('account_id', null)
    .is('card_id', null)

  if (error) throw toApiError(error)
  return count ?? 0
}
