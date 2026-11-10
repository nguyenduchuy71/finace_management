/** Khớp `minimum_password_length` của GoTrue (supabase/config.toml + dashboard production). */
export const MIN_PASSWORD = 8

/** Lỗi đặt mật khẩu mới (updateUser) theo mã GoTrue; không lộ chi tiết nội bộ. */
export function newPasswordErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'weak_password': return `Mật khẩu quá yếu — tối thiểu ${MIN_PASSWORD} ký tự, nên có chữ và số.`
    case 'same_password': return 'Mật khẩu mới phải khác mật khẩu cũ.'
    case 'session_not_found':
    case 'session_expired': return 'Liên kết đặt lại đã hết hạn. Vui lòng gửi lại liên kết mới.'
    default: return 'Không đặt được mật khẩu mới. Vui lòng thử lại.'
  }
}
