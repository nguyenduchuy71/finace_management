import { supabase } from '@/lib/supabase'
import { toApiError } from './api-errors'

/** Có ít nhất một dòng không — `select('id').limit(1)`. KHÔNG dùng count: count bỏ qua limit, đếm mọi dòng của user. */
async function exists(table: 'transactions' | 'unparsed_messages'): Promise<boolean> {
  const { data, error } = await supabase.from(table).select('id').limit(1)
  if (error) throw toApiError(error)
  return (data?.length ?? 0) > 0
}

/**
 * Đã từng nhận tin nào từ Shortcut chưa: có giao dịch HOẶC có tin trong hộp (kể cả đã xử lý, kể cả quảng cáo).
 * Chỉ lấy tối đa 1 id mỗi bảng; RLS giới hạn trong user hiện tại.
 */
export async function hasReceivedAnyMessage(): Promise<boolean> {
  const [tx, msg] = await Promise.all([exists('transactions'), exists('unparsed_messages')])
  return tx || msg
}
