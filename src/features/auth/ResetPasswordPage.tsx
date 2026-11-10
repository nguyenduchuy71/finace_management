import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { AuthCard } from './AuthCard'
import { PasswordInput } from './PasswordInput'
import { MIN_PASSWORD, newPasswordErrorMessage } from './password-policy'
import { updatePassword } from './password-recovery'

/**
 * /reset-password: đích của liên kết trong email. supabase-js tự đọc token trên URL và tạo phiên khôi phục
 * TRƯỚC khi AuthProvider hết `loading`, nên tới đây không có phiên = liên kết sai / hết hạn / đã dùng.
 */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null

  if (!session) {
    return (
      <AuthCard title="Liên kết không còn hiệu lực">
        <div role="alert" className="space-y-3 text-sm">
          <p>Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Hãy gửi lại liên kết mới.</p>
          <Button asChild className="w-full"><Link to="/forgot-password">Gửi lại liên kết</Link></Button>
        </div>
      </AuthCard>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự.`)
    if (password !== confirm) return setError('Hai mật khẩu chưa khớp.')
    setError(null)
    setSubmitting(true)
    try {
      const code = await updatePassword(password)
      if (code) return setError(newPasswordErrorMessage(code))
      toast.success('Đã đặt mật khẩu mới.')
      navigate('/accounts', { replace: true })
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Đặt mật khẩu mới">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="body-sm text-muted-foreground">Cho tài khoản <strong className="text-foreground">{session.user.email}</strong></p>
        <div className="space-y-2">
          <label htmlFor="new-password" className="heading-label">Mật khẩu mới</label>
          <PasswordInput
            id="new-password" autoComplete="new-password" required minLength={MIN_PASSWORD}
            aria-describedby="new-password-hint" aria-invalid={error !== null}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <p id="new-password-hint" className="text-xs text-muted-foreground">Tối thiểu {MIN_PASSWORD} ký tự.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-password" className="heading-label">Nhập lại mật khẩu mới</label>
          <PasswordInput
            id="confirm-password" autoComplete="new-password" required aria-invalid={error !== null}
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
        </Button>
      </form>
    </AuthCard>
  )
}
