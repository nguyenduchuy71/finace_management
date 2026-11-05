/**
 * Site key Cloudflare Turnstile (công khai, nằm trong bundle). Trống = KHÔNG có captcha: form gửi như cũ.
 * Chỉ đặt khi production đã bật captcha Turnstile ở Supabase Auth (cùng cặp site key / secret key) — đặt lệch
 * một bên là đăng nhập/đăng ký hỏng: Auth bật mà thiếu key -> mọi request thiếu token; key có mà Auth tắt thì vô hại.
 */
export const CAPTCHA_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? ''
