import { supabase } from '@/lib/supabase'
import { mapCreditCard, type CreditCardRow } from './mappers'
import { toApiError } from './api-errors'
import type { CardFormValues } from '@/types/credit-card-form'

/** Giá trị form (camelCase, đã chuẩn hoá) -> cột của bảng `credit_cards`. */
function toRow(v: CardFormValues) {
  return {
    bank_name: v.bankName,
    card_name: v.cardName,
    card_number: v.cardNumber,
    card_type: v.cardType,
    statement_date: v.statementDate,
    payment_due_date: v.paymentDueDate,
    credit_limit: v.creditLimit,
  }
}

const CARD_ERRORS: Record<string, string> = {
  '23505': 'Thẻ này đã tồn tại (cùng ngân hàng và số thẻ).',
}

// Không gửi `user_id`: cột có default auth.uid() và RLS kiểm lại. `currency` mặc
// định 'VND', `current_balance` mặc định 0 (không có trong SMS ngân hàng).
export async function createCreditCard(values: CardFormValues) {
  const { data, error } = await supabase
    .from('credit_cards')
    .insert(toRow(values))
    .select('*')
    .single()
  if (error) throw toApiError(error, CARD_ERRORS)
  return mapCreditCard(data as CreditCardRow)
}

export async function updateCreditCard(id: string, values: CardFormValues) {
  const { data, error } = await supabase
    .from('credit_cards')
    .update({ ...toRow(values), last_updated: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toApiError(error, CARD_ERRORS)
  return mapCreditCard(data as CreditCardRow)
}

/** Số giao dịch gắn với thẻ — để dialog xoá nói rõ sẽ mất bao nhiêu. */
export async function countCardTransactions(cardId: string): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)
  if (error) throw toApiError(error)
  return count ?? 0
}

/**
 * Xoá thẻ KÈM toàn bộ giao dịch, nguyên tử, qua RPC `delete_credit_card`.
 * Không xoá bằng 2 lời gọi client: giữa hai lệnh có thể lọt giao dịch mới và bị
 * `on delete set null` thành giao dịch mồ côi (ẩn khỏi danh sách, dashboard vẫn đếm).
 * Trả về số giao dịch đã xoá.
 */
export async function deleteCreditCard(cardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_credit_card', { p_card_id: cardId })
  if (error) throw toApiError(error)
  return data as number
}
