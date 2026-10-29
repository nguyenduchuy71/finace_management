import { supabase } from '@/lib/supabase'
import type { ApiError, PaginatedResponse } from '@/types/api'
import { CardTransactionPatchSchema, type CardTransactionPatch } from '@/types/card-transaction-patch'
import { MccSchema, type CreditCard, type CreditCardTransaction } from '@/types/creditCard'
import { mapCreditCard, mapCreditCardTransaction, type CreditCardRow } from './mappers'
import { toApiError, requireAffected } from './api-errors'
import { fetchTransactionPage, type TxScope } from './transaction-fetch'
import { TX_PAGE_SIZE, EMPTY_TX_PAGE, type TransactionFilters } from './transactionQuery'

/** Phạm vi query theo một thẻ, nhiều thẻ, hoặc mọi thẻ (`cardIds` rỗng). */
export function cardScope(card: string | MultiCardSelection): TxScope {
  return (q) => typeof card === 'string'
    ? q.eq('card_id', card)
    : card.cardIds.length > 0
      ? q.in('card_id', [...card.cardIds])
      : q.not('card_id', 'is', null)
}

export async function getCreditCards(): Promise<PaginatedResponse<CreditCard>> {
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
): Promise<PaginatedResponse<CreditCardTransaction>> {
  // Thẻ tín dụng chỉ có chi tiêu -> txType='income' luôn rỗng (giữ hành vi cũ của mock)
  if (filters?.txType === 'income') {
    return EMPTY_TX_PAGE
  }

  // Keyset (transaction_date, id) của applyTransactionFilters vẫn đúng khi gộp nhiều thẻ: thứ tự toàn cục.
  return fetchTransactionPage(cardScope(card), mapCreditCardTransaction, { cursor, limit, filters })
}

const TX_NOT_FOUND = 'Không tìm thấy giao dịch.'

/**
 * Gán (hoặc bỏ, bằng null) MCC cho một giao dịch thẻ. DB cũng có check 4 chữ số; validate ở
 * đây để lỗi dừng trước khi gọi mạng.
 *
 * Giao dịch không tồn tại hoặc không thuộc user bị RLS lọc thành 0 dòng — PostgREST khi đó
 * trả thành công với mảng rỗng, nên phải tự kiểm để không "lưu thành công" mà không lưu gì.
 */
export async function updateCardTransactionMcc(txId: string, mcc: string | null): Promise<void> {
  const parsed = MccSchema.nullable().safeParse(mcc)
  if (!parsed.success) {
    throw { code: 'INVALID_MCC', message: parsed.error.issues[0].message } satisfies ApiError
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ mcc: parsed.data })
    .eq('id', txId)
    .select('id')
  if (error) throw toApiError(error)
  requireAffected(data, TX_NOT_FOUND)
}

/**
 * Sửa một giao dịch thẻ. Chỉ gửi trường có trong `patch` để không ghi đè những gì không đổi (vd giây
 * của `transaction_date`, ô datetime-local chỉ tới phút). RLS `own_tx_update` giới hạn về chính user;
 * 0 dòng = không tồn tại / không phải của user (PostgREST vẫn trả thành công nên phải tự kiểm).
 */
export async function updateCardTransaction(txId: string, patch: CardTransactionPatch): Promise<void> {
  const parsed = CardTransactionPatchSchema.safeParse(patch)
  if (!parsed.success) {
    throw { code: 'INVALID_TRANSACTION', message: parsed.error.issues[0].message } satisfies ApiError
  }
  const p = parsed.data
  const row = {
    ...(p.amount !== undefined && { amount: p.amount }),
    ...(p.transactionDate !== undefined && { transaction_date: p.transactionDate }),
    ...(p.merchantName !== undefined && { merchant_name: p.merchantName || null }),
    ...(p.description !== undefined && { description: p.description || null }),
    ...(p.category !== undefined && { category: p.category }),
    ...(p.kind !== undefined && { kind: p.kind }),
    ...(p.mcc !== undefined && { mcc: p.mcc }),
  }
  if (Object.keys(row).length === 0) return

  const { data, error } = await supabase
    .from('transactions')
    .update(row)
    .eq('id', txId)
    .not('card_id', 'is', null)
    .select('id')
  if (error) throw toApiError(error)
  requireAffected(data, TX_NOT_FOUND)
}
