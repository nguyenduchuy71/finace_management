import { supabase } from '@/lib/supabase'
import { countRows } from './api-errors'

/**
 * Đã từng nhận tin nào từ Shortcut chưa: có giao dịch HOẶC có tin trong hộp (kể cả đã xử lý, kể cả quảng cáo).
 * Chỉ đếm sự tồn tại (`limit(1)`, head) — không kéo dữ liệu về browser. RLS giới hạn trong user hiện tại.
 */
export async function hasReceivedAnyMessage(): Promise<boolean> {
  const [tx, msg] = await Promise.all([
    countRows(supabase.from('transactions').select('id', { count: 'exact', head: true }).limit(1)),
    countRows(supabase.from('unparsed_messages').select('id', { count: 'exact', head: true }).limit(1)),
  ])
  return tx + msg > 0
}
