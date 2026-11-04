// Hạn giữ tin QUẢNG CÁO trong hộp "Chưa phân loại".
//
// Production 18/10–04/11/2026: 56% tin trong unparsed_messages là gợi ý `promo`, và không tin nào trong số đó
// từng được user chốt thành giao dịch. Vẫn LƯU (classifyUnparsed chỉ là gợi ý — nếu gắn nhầm một giao dịch thật,
// user còn 7 ngày để thấy nó trong mục quảng cáo), nhưng xoá sau 7 ngày thay vì giữ mãi.
//
// Chạy ngay trong edge function mỗi lần lưu tin vào hộp, không dùng pg_cron: production chưa bật extension này,
// và hộp chỉ phình ra đúng lúc có tin mới.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const PROMO_RETENTION_DAYS = 7

/**
 * Xoá tin gợi ý `promo` của user cũ hơn PROMO_RETENTION_DAYS mà user CHƯA đụng tới (chưa resolved, chưa chốt
 * `kind`). Lỗi chỉ ghi log — không được làm hỏng việc lưu tin vừa nhận.
 */
export async function purgeStalePromos(db: SupabaseClient, userId: string, now = Date.now()): Promise<void> {
  const before = new Date(now - PROMO_RETENTION_DAYS * 86_400_000).toISOString()
  const { error } = await db
    .from('unparsed_messages')
    .delete()
    .eq('user_id', userId)
    .eq('suggested_kind', 'promo')
    .eq('resolved', false)
    .is('kind', null)
    .lt('received_at', before)
  if (error) console.error('purgeStalePromos failed', error.code, error.message)
}
