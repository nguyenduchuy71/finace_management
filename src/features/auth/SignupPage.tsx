import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MailCheck, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { PRIVACY_POLICY_VERSION } from '@/types/api-key'

const MIN_PASSWORD = 8

/**
 * Thông điệp theo mã lỗi GoTrue. Không hiện "email đã tồn tại": khi bật xác nhận email
 * GoTrue trả thành công giả cho email đã có — giữ nguyên để không lộ ai đã đăng ký.
 */
function signupErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'signup_disabled': return 'Đăng ký đang tạm đóng. Vui lòng quay lại sau.'
    case 'weak_password': return `Mật khẩu quá yếu — tối thiểu ${MIN_PASSWORD} ký tự, nên có chữ và số.`
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Thử quá nhiều lần. Đợi vài phút rồi thử lại.'
    case 'email_address_invalid': return 'Email không hợp lệ.'
    default: return 'Đăng ký thất bại. Vui lòng thử lại.'
  }
}

export function SignupPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/settings" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự.`)
      return
    }
    if (!consent) {
      setError('Cần đồng ý với cách xử lý dữ liệu để tạo tài khoản.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Trigger handle_new_user ghi phiên bản + thời điểm đồng ý vào user_settings.
          data: { privacy_policy_version: PRIVACY_POLICY_VERSION },
          emailRedirectTo: `${window.location.origin}/settings`,
        },
      })
      if (err) setError(signupErrorMessage(err.code))
      // Có session = không cần xác nhận email -> AuthProvider tự điều hướng.
      else if (!data.session) setCheckEmail(true)
    } catch {
      // signUp có thể throw khi mất mạng (giống LoginPage).
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="heading-h3 tracking-tight">Tạo tài khoản</span>
        </div>

        {checkEmail ? (
          <div className="space-y-3 text-sm" role="status">
            <MailCheck className="h-6 w-6 text-primary" />
            <p>Đã gửi email xác nhận tới <strong>{email}</strong>. Mở email và bấm liên kết để kích hoạt tài khoản.</p>
            <Link to="/login" className="text-primary underline">Về trang đăng nhập</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="signup-email" className="heading-label">Email</label>
              <Input
                id="signup-email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-password" className="heading-label">Mật khẩu</label>
              <Input
                id="signup-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD}
                aria-describedby="signup-password-hint"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <p id="signup-password-hint" className="text-xs text-muted-foreground">Tối thiểu {MIN_PASSWORD} ký tự.</p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox" className="mt-1" checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Tôi đồng ý cho ứng dụng lưu và xử lý nội dung thông báo ngân hàng tôi gửi lên (gồm số tiền,
                số dư, tên người giao dịch) để ghi và thống kê giao dịch của riêng tôi. Tôi có thể xoá tài khoản
                cùng toàn bộ dữ liệu bất cứ lúc nào trong Cài đặt.
              </span>
            </label>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Đã có tài khoản? <Link to="/login" className="text-primary underline">Đăng nhập</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  )
}
