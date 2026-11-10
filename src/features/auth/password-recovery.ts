import { supabase } from '@/lib/supabase'

/** Trang nhận liên kết trong email (route công khai, phải nằm trong Redirect URLs của Supabase Auth). */
export const RESET_PASSWORD_PATH = '/reset-password'

/**
 * Gửi email đặt lại mật khẩu. GoTrue trả thành công cả khi email không tồn tại (không lộ ai đã đăng ký),
 * nên UI luôn báo trung tính. Trả mã lỗi GoTrue (rate limit, captcha...) hoặc null.
 */
export async function requestPasswordReset(email: string, captchaToken: string | null): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
    ...(captchaToken && { captchaToken }),
  })
  return error ? (error.code ?? 'unknown') : null
}

/** Đặt mật khẩu mới cho phiên hiện tại (phiên khôi phục tạo từ liên kết email). Trả mã lỗi hoặc null. */
export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password })
  return error ? (error.code ?? 'unknown') : null
}
