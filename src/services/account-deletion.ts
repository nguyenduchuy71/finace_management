import { supabase } from '@/lib/supabase'
import type { ApiError } from '@/types/api'

/**
 * Xoá vĩnh viễn tài khoản đang đăng nhập cùng TOÀN BỘ dữ liệu (cascade theo user_id).
 * Client không xoá được auth.users nên đi qua edge function `delete-account`, function
 * lấy user từ JWT của phiên — không nhận user id từ client.
 */
export async function deleteMyAccount(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (!error) {
      // Phiên cũ trỏ tới user không còn tồn tại. `scope: 'local'` vì refresh token đã
      // chết cùng user — gọi server để thu hồi chỉ lỗi vô ích.
      await supabase.auth.signOut({ scope: 'local' })
      return
    }
    console.error('[delete-account]', error.message)
  } catch (e) {
    console.error('[delete-account]', String(e))
  }
  const apiError: ApiError = {
    code: 'DELETE_ACCOUNT_FAILED',
    message: 'Không xoá được tài khoản. Kiểm tra mạng rồi thử lại.',
  }
  throw apiError
}
