import { supabase } from '@/lib/supabase'
import {
  mapCreditCard, mapCreditCardTransaction, toApiError, encodeCursor,
  type CreditCardRow, type TransactionRow,
} from './mappers'
import {
  applyTransactionFilters, paginate, totalForPage, countOption, TX_COLUMNS,
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

export async function getCreditCardTransactions(
  cardId: string,
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters
) {
  // Thẻ tín dụng chỉ có chi tiêu -> txType='income' luôn rỗng (giữ hành vi cũ của mock)
  if (filters?.txType === 'income') {
    return { data: [], nextCursor: null, total: 0 }
  }

  const base = supabase
    .from('transactions')
    .select(TX_COLUMNS, countOption(cursor))
    .eq('card_id', cardId)

  const { data, error, count } = await applyTransactionFilters(base, cursor, limit, filters)
  if (error) throw toApiError(error)

  const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], limit)
  return {
    data: rows.map(mapCreditCardTransaction),
    nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    total: totalForPage(count, cursor),
  }
}
