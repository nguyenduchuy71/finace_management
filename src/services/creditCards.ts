import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { ApiError } from '@/types/api'
import { mapCreditCard, mapCreditCardTransaction, type CreditCardRow, type TransactionRow } from './mappers'
import { toApiError } from './api-errors'
import { encodeCursor } from './query-cursor'
import {
  applyTransactionFilters, paginate, totalForPage, countOption, TX_COLUMNS, TX_PAGE_SIZE,
  type TransactionFilters,
} from './transactionQuery'

export async function getCreditCards() {
  const { data, error, count } = await supabase
    .from('credit_cards')
    .select('*', { count: 'exact' })
    .order('bank_name')

  if (error) throw toApiError(error)
  return {
    data: ((data ?? []) as CreditCardRow[]).map(mapCreditCard),
    nextCursor: null,
    total: count ?? 0,
  }
}

/** Nhiều thẻ một lúc: `cardIds` rỗng = TẤT CẢ thẻ của user (RLS giới hạn về chính user). */
export interface MultiCardSelection {
  cardIds: readonly string[]
}

export async function getCreditCardTransactions(
  card: string | MultiCardSelection,
  cursor?: string,
  limit = TX_PAGE_SIZE,
  filters?: TransactionFilters
) {
  // Thẻ tín dụng chỉ có chi tiêu -> txType='income' luôn rỗng (giữ hành vi cũ của mock)
  if (filters?.txType === 'income') {
    return { data: [], nextCursor: null, total: 0 }
  }

  const query = supabase.from('transactions').select(TX_COLUMNS, countOption(cursor))
  // Keyset (transaction_date, id) của applyTransactionFilters vẫn đúng khi gộp nhiều thẻ: thứ tự toàn cục.
  const base = typeof card === 'string'
    ? query.eq('card_id', card)
    : card.cardIds.length > 0
      ? query.in('card_id', [...card.cardIds])
      : query.not('card_id', 'is', null)

  const { data, error, count } = await applyTransactionFilters(base, cursor, limit, filters)
  if (error) throw toApiError(error)

  const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], limit)
  return {
    data: rows.map(mapCreditCardTransaction),
    nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    total: totalForPage(count, cursor),
  }
}

const MccSchema = z.string().regex(/^\d{4}$/, 'MCC phải gồm 4 chữ số').nullable()

/**
 * Gán (hoặc bỏ, bằng null) MCC cho một giao dịch thẻ. DB cũng có check 4 chữ số; validate ở
 * đây để lỗi dừng trước khi gọi mạng.
 *
 * Giao dịch không tồn tại hoặc không thuộc user bị RLS lọc thành 0 dòng — PostgREST khi đó
 * trả thành công với mảng rỗng, nên phải tự kiểm để không "lưu thành công" mà không lưu gì.
 */
export async function updateCardTransactionMcc(txId: string, mcc: string | null): Promise<void> {
  const parsed = MccSchema.safeParse(mcc)
  if (!parsed.success) {
    throw { code: 'INVALID_MCC', message: parsed.error.issues[0].message } satisfies ApiError
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ mcc: parsed.data })
    .eq('id', txId)
    .select('id')
  if (error) throw toApiError(error)
  if (!data || data.length === 0) {
    throw { code: 'NOT_FOUND', message: 'Không tìm thấy giao dịch.' } satisfies ApiError
  }
}
