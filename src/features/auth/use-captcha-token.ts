import { useCallback, useState } from 'react'
import { CAPTCHA_SITE_KEY } from '@/config/captcha-config'

/**
 * Trạng thái captcha của một form auth. `required` = false khi chưa cấu hình site key (form gửi như cũ).
 * Token Turnstile chỉ dùng được MỘT lần: gọi `reset()` sau mỗi lần gửi (thành công hay lỗi) để mount lại widget.
 */
export function useCaptchaToken() {
  const [token, setToken] = useState<string | null>(null)
  const [widgetKey, setWidgetKey] = useState(0)
  const reset = useCallback(() => {
    setToken(null)
    setWidgetKey((k) => k + 1)
  }, [])
  return { required: CAPTCHA_SITE_KEY !== '', siteKey: CAPTCHA_SITE_KEY, token, setToken, widgetKey, reset }
}

/** Thông điệp khi GoTrue từ chối token captcha (sai / hết hạn / đã dùng). */
export const CAPTCHA_FAILED_MESSAGE = 'Xác minh chống robot không hợp lệ hoặc đã hết hạn. Vui lòng xác minh lại.'
export const CAPTCHA_MISSING_MESSAGE = 'Vui lòng hoàn tất xác minh chống robot.'
