import { supabase } from '@/lib/supabase'
import { mapAccount, type AccountRow } from './mappers'
import { toApiError, countRows } from './api-errors'
import type { AccountFormValues } from '@/types/account-form'

/** Giá trị form (camelCase, đã chuẩn hoá) -> cột của bảng `accounts`. */
function toRow(v: AccountFormValues) {
  return {
    bank_name: v.bankName,
    account_name: v.accountName,
    account_number: v.accountNumber,
    account_type: v.accountType,
    balance: v.balance,
  }
}

const ACCOUNT_ERRORS: Record<string, string> = {
  '23505': 'Tài khoản này đã có (trùng ngân hàng và số tài khoản).',
  '23514': 'Số tài khoản phải có dạng ****xxxx.',
  P0002: 'Không tìm thấy tài khoản (đã bị xoá hoặc không thuộc về bạn).',
}

// Không gửi `user_id`: cột có default auth.uid() và RLS kiểm lại.
export async function createAccount(values: AccountFormValues) {
  const { data, error } = await supabase
    .from('accounts')
    .insert(toRow(values))
    .select('*')
    .single()
  if (error) throw toApiError(error, ACCOUNT_ERRORS)
  return mapAccount(data as AccountRow)
}

export async function updateAccount(id: string, values: AccountFormValues) {
  const { data, error } = await supabase
    .from('accounts')
    .update({ ...toRow(values), last_updated: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw toApiError(error, ACCOUNT_ERRORS)
  return mapAccount(data as AccountRow)
}

/** Số giao dịch gắn với tài khoản — để dialog xoá nói rõ sẽ mất bao nhiêu. */
export async function countAccountTransactions(accountId: string): Promise<number> {
  return countRows(
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
  )
}

/**
 * Xoá TK KÈM toàn bộ giao dịch, nguyên tử, qua RPC `delete_bank_account` (cùng lý do với
 * deleteCreditCard: xoá trần để lại giao dịch mồ côi). Trả số giao dịch đã xoá.
 */
export async function deleteAccount(accountId: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_bank_account', { p_account_id: accountId })
  if (error) throw toApiError(error, ACCOUNT_ERRORS)
  return data as number
}
