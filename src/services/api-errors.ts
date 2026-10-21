import type { PostgrestError } from '@supabase/supabase-js'
import type { ApiError } from '@/types/api'

/**
 * Thông điệp hiển thị cho user, theo mã lỗi Postgres.
 * Không bao giờ lộ `message`/`details` gốc: chúng chứa tên cột, tên bảng, hint
 * của PostgREST — thông tin nội bộ, và với user thì cũng vô nghĩa.
 */
const ERROR_MESSAGES: Record<string, string> = {
  '42501': 'Bạn không có quyền xem dữ liệu này.',
  '23505': 'Dữ liệu đã tồn tại.',
  P0002: 'Không tìm thấy thẻ (đã bị xoá hoặc không thuộc về bạn).',
  '23502': 'Thiếu thông tin bắt buộc.',
  '22007': 'Giá trị ngày tháng không hợp lệ.',
  '22P02': 'Dữ liệu gửi lên không đúng định dạng.',
  PGRST301: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

/**
 * Giữ nguyên contract ApiError để component không phải đổi.
 *
 * `message` giờ là chuỗi an toàn để render thẳng ra UI (TransactionList và
 * CreditCardTransactionList đang hiển thị trực tiếp field này). Chi tiết kỹ thuật
 * đẩy vào console cho dev, và `details` không còn được truyền đi.
 */
export function toApiError(e: PostgrestError, overrides?: Record<string, string>): ApiError {
  const code = e.code ?? 'SUPABASE_ERROR'
  console.error('[supabase]', code, e.message, e.details ?? '')
  return {
    code,
    // `overrides`: thông điệp riêng của từng RPC cho mã dùng chung (vd P0002 ở
    // resolve_unparsed không phải "không tìm thấy thẻ").
    message: overrides?.[code] ?? ERROR_MESSAGES[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  }
}
