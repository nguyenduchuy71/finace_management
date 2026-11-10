import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthCard } from './AuthCard'
import { CaptchaWidget } from './CaptchaWidget'
import { requestPasswordReset } from './password-recovery'
import { CAPTCHA_FAILED_MESSAGE, CAPTCHA_MISSING_MESSAGE, useCaptchaToken } from './use-captcha-token'

function requestErrorMessage(code: string): string {
  switch (code) {
    case 'over_request_rate_limit': return 'Gửi quá nhiều lần. Đợi vài phút rồi thử lại.'
    case 'email_address_invalid':
    case 'validation_failed': return 'Email không hợp lệ.'
    case 'captcha_failed': return CAPTCHA_FAILED_MESSAGE
    default: return 'Không gửi được email. Vui lòng thử lại.'
  }
}

/** /forgot-password: gửi liên kết đặt lại mật khẩu. Captcha (khi bật) bắt buộc với cả /recover của GoTrue. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const captcha = useCaptchaToken()
  // Khối thông báo thay hẳn form nên live region chèn kèm nội dung có thể không được đọc: chuyển focus vào nó.
  const sentRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (sent) sentRef.current?.focus() }, [sent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (captcha.required && !captcha.token) {
      toast.error(CAPTCHA_MISSING_MESSAGE)
      return
    }
    setSubmitting(true)
    try {
      const code = await requestPasswordReset(email, captcha.token)
      // Giới hạn GỬI EMAIL chỉ chạm tới khi GoTrue thật sự gửi (= email có tài khoản): báo lỗi riêng sẽ lộ
      // email nào đã đăng ký -> hiện như thành công (thông điệp trung tính đã dặn chờ / thử lại).
      if (!code || code === 'over_email_send_rate_limit') setSent(true)
      else toast.error(requestErrorMessage(code))
    } catch {
      toast.error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
      if (captcha.required) captcha.reset()
    }
  }

  if (sent) {
    return (
      <AuthCard title="Kiểm tra email">
        <div ref={sentRef} tabIndex={-1} role="status" className="space-y-3 text-sm outline-none">
          <MailCheck className="h-6 w-6 text-primary" aria-hidden />
          {/* Trung tính: không xác nhận email có tồn tại hay không */}
          <p>Nếu <strong>{email.trim()}</strong> có tài khoản, thư chứa liên kết đặt lại mật khẩu sẽ tới trong vài phút. Kiểm tra cả mục thư rác. Không thấy thư sau 10 phút thì thử gửi lại sau.</p>
          <Link to="/login" className="text-primary underline">Về trang đăng nhập</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Quên mật khẩu">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="body-sm text-muted-foreground">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
        <div className="space-y-2">
          <label htmlFor="forgot-email" className="heading-label">Email</label>
          <Input
            id="forgot-email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {captcha.required && (
          <CaptchaWidget key={captcha.widgetKey} siteKey={captcha.siteKey} onToken={captcha.setToken} />
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Nhớ ra rồi? <Link to="/login" className="text-primary underline">Đăng nhập</Link>
        </p>
      </form>
    </AuthCard>
  )
}
