import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { APP_NAME } from '@/components/layout/BrandMark'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/accounts" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      // Không log password / error object ra console
      // user_banned = admin đã khoá: báo "sai mật khẩu" thì user đi đổi mật khẩu vô ích.
      if (error?.code === 'user_banned') toast.error('Tài khoản đang bị tạm khoá. Liên hệ quản trị để được mở khoá.')
      else if (error) toast.error('Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.')
    } catch {
      // signInWithPassword CÓ THỂ throw khi mất mạng (không chỉ trả { error }).
      // Thiếu try/catch thì submitting kẹt true -> nút disabled vĩnh viễn,
      // user phải reload trang mới đăng nhập lại được.
      toast.error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <Link to="/" className="mb-6 flex w-fit items-center gap-2" aria-label="Về trang chủ">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="heading-h3 tracking-tight">{APP_NAME}</span>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="heading-label">Email</label>
            <Input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="heading-label">Mật khẩu</label>
            <Input
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
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
      </Card>
    </div>
  )
}
