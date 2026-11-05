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
  P0002: 'Không tìm thấy dữ liệu (đã bị xoá hoặc không thuộc về bạn).',
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
    // delete_bank_account không phải "không tìm thấy thẻ").
    message: overrides?.[code] ?? ERROR_MESSAGES[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  }
}

/**
 * Mã lỗi (`{ error: '<code>' }`) trong body của lỗi HTTP từ `supabase.functions.invoke`: FunctionsHttpError mang
 * Response gốc ở `context`. Không đọc được thì 'internal_error'.
 */
export async function readFunctionErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      // body không phải JSON -> giữ mã chung
    }
  }
  return 'internal_error'
}

/** Thông điệp "không thấy thẻ" dùng ở nhiều nơi (xoá thẻ, đặt trần hoàn tiền). */
export const CARD_NOT_FOUND = 'Không tìm thấy thẻ (đã bị xoá hoặc không thuộc về bạn).'

/** Lỗi NOT_FOUND với thông điệp riêng của thực thể (thẻ, rule, giao dịch...). */
export function notFound(message: string): ApiError {
  return { code: 'NOT_FOUND', message }
}

/**
 * RLS lọc 0 dòng thì PostgREST vẫn báo thành công với mảng rỗng: gọi sau `.select('id')` của
 * update/delete để không "lưu/xoá thành công" mà không đổi gì.
 */
export function requireAffected(data: unknown[] | null, message: string): void {
  if (!data || data.length === 0) throw notFound(message)
}

/** Chạy query đếm (`select('id', { count: 'exact', head: true })`): ném ApiError khi lỗi, trả số dòng. */
export async function countRows(
  query: PromiseLike<{ count: number | null; error: PostgrestError | null }>,
  overrides?: Record<string, string>,
): Promise<number> {
  const { count, error } = await query
  if (error) throw toApiError(error, overrides)
  return count ?? 0
}

/**
 * Thông điệp hiển thị cho một lỗi bắt trong `catch`: `message` của ApiError (đã an toàn để render, xem
 * `toApiError`) hoặc của Error, không có thì `fallback`.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const message = (err as Partial<ApiError> | null)?.message
  return typeof message === 'string' && message ? message : fallback
}
