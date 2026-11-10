import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthCard } from './AuthCard'
import { PasswordInput } from './PasswordInput'
import { CaptchaWidget } from './CaptchaWidget'
import { CAPTCHA_FAILED_MESSAGE, CAPTCHA_MISSING_MESSAGE, useCaptchaToken } from './use-captcha-token'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const captcha = useCaptchaToken()

  if (loading) return null
  if (session) return <Navigate to="/accounts" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (captcha.required && !captcha.token) {
      toast.error(CAPTCHA_MISSING_MESSAGE)
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captcha.token && { options: { captchaToken: captcha.token } }),
      })
      // Không log password / error object ra console
      // user_banned = admin đã khoá: báo "sai mật khẩu" thì user đi đổi mật khẩu vô ích.
      if (error?.code === 'user_banned') toast.error('Tài khoản đang bị tạm khoá. Liên hệ quản trị để được mở khoá.')
      else if (error?.code === 'captcha_failed') toast.error(CAPTCHA_FAILED_MESSAGE)
      else if (error) toast.error('Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.')
    } catch {
      // signInWithPassword CÓ THỂ throw khi mất mạng (không chỉ trả { error }).
      // Thiếu try/catch thì submitting kẹt true -> nút disabled vĩnh viễn,
      // user phải reload trang mới đăng nhập lại được.
      toast.error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
      if (captcha.required) captcha.reset()
    }
  }

  return (
    <AuthCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="heading-label">Email</label>
            <Input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="password" className="heading-label">Mật khẩu</label>
              <Link to="/forgot-password" className="text-sm text-primary underline-offset-2 hover:underline">Quên mật khẩu?</Link>
            </div>
            <PasswordInput
              id="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {captcha.required && (
            <CaptchaWidget key={captcha.widgetKey} siteKey={captcha.siteKey} onToken={captcha.setToken} />
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Chưa có tài khoản? <Link to="/signup" className="text-primary underline">Đăng ký</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/privacy" className="underline">Chính sách bảo mật</Link>
            {' · '}
            <Link to="/terms" className="underline">Điều khoản sử dụng</Link>
          </p>
        </form>
    </AuthCard>
  )
}
