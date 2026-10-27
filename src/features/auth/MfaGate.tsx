import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { getMfaStatus, startTotpEnrollment, verifyTotp, type MfaStatus, type TotpEnrollment } from './mfa'

const CODE_FORMAT = /^\d{6}$/

/** Ô nhập mã 6 số + nút xác nhận, dùng chung cho đăng ký lần đầu và đăng nhập lại. */
function CodeForm({ factorId, onVerified }: { factorId: string; onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const c = code.replace(/\s/g, '')
    if (!CODE_FORMAT.test(c)) {
      setError('Mã gồm 6 chữ số.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await verifyTotp(factorId, c)
      onVerified()
    } catch {
      // Không phân biệt sai mã / hết hạn: thông điệp gốc của GoTrue không giúp gì thêm.
      setError('Mã không đúng hoặc đã hết hạn. Nhập mã mới nhất trong ứng dụng xác thực.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <label htmlFor="totp-code" className="text-sm font-medium">Mã xác thực (6 số)</label>
      <div className="flex gap-2">
        <Input
          id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="font-mono"
          value={code} aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'totp-code-error' : undefined}
          onChange={(e) => { setCode(e.target.value); setError(null) }}
        />
        <Button type="submit" disabled={busy}>{busy ? 'Đang kiểm…' : 'Xác nhận'}</Button>
      </div>
      {error && <p id="totp-code-error" role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

function Enroll({ onVerified }: { onVerified: () => void }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Bắt đầu bằng nút, không tự chạy lúc mount: StrictMode mount 2 lần sẽ tạo 2 factor.
  async function start() {
    setBusy(true)
    setError(null)
    try {
      setEnrollment(await startTotpEnrollment())
    } catch {
      setError('Không bắt đầu được. Kiểm tra MFA TOTP đã bật trên Supabase (Authentication → Multi-Factor).')
    } finally {
      setBusy(false)
    }
  }

  if (!enrollment) {
    return (
      <div className="space-y-3 text-sm">
        <p>Trang quản trị bắt buộc xác thực hai lớp. Cài một ứng dụng xác thực (Google Authenticator, 1Password…) rồi bấm bắt đầu.</p>
        <Button type="button" onClick={start} disabled={busy}>{busy ? 'Đang chuẩn bị…' : 'Bắt đầu thiết lập'}</Button>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    )
  }
  return (
    <div className="space-y-4 text-sm">
      <p>Quét mã QR bằng ứng dụng xác thực, rồi nhập mã 6 số nó hiển thị.</p>
      {/* QR là data: URL do GoTrue sinh — CSP img-src đã cho phép data: */}
      <img src={enrollment.qrCode} alt="Mã QR thiết lập xác thực hai lớp" className="h-44 w-44 rounded-lg bg-white p-2" />
      <p className="text-muted-foreground">
        Không quét được? Nhập khoá thủ công: <code className="break-all font-mono">{enrollment.secret}</code>
      </p>
      <CodeForm factorId={enrollment.factorId} onVerified={onVerified} />
    </div>
  )
}

/**
 * Chặn nội dung bên trong tới khi phiên đạt aal2. Function `admin` vẫn tự kiểm aal2 —
 * gate này chỉ để admin không gặp lỗi 403 mfa_required trên từng nút.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MfaStatus | 'loading' | 'error'>('loading')
  // Tăng để kiểm lại (sau khi nhập đúng mã / bấm Thử lại). setState 'loading' ở event handler,
  // effect chỉ setState trong callback bất đồng bộ.
  const [attempt, setAttempt] = useState(0)
  const check = () => { setStatus('loading'); setAttempt((n) => n + 1) }
  // Kiểm lại cả khi phiên đổi: đăng nhập lại (vd ở tab khác) chỉ được aal1 -> function trả
  // mfa_required cho mọi nút; không theo dõi token thì admin kẹt ở màn lỗi, không về màn nhập mã.
  const token = useAuth().session?.access_token

  useEffect(() => {
    let active = true
    getMfaStatus()
      .then((s) => { if (active) setStatus(s) })
      // Kiểm lại (token refresh) mà lỗi mạng: giữ trang nếu phiên đã aal2 — function vẫn tự kiểm aal2
      // cho từng lời gọi, gỡ trang đang dùng chỉ vì một lần mạng chập chờn là tệ hơn.
      .catch(() => { if (active) setStatus((prev) => (typeof prev === 'object' && prev.step === 'verified' ? prev : 'error')) })
    return () => { active = false }
  }, [attempt, token])

  if (status === 'loading') return <p className="text-sm text-muted-foreground">Đang kiểm tra xác thực hai lớp…</p>
  if (status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        Không kiểm tra được trạng thái xác thực.{' '}
        <button type="button" className="underline" onClick={check}>Thử lại</button>
      </p>
    )
  }
  if (status.step === 'verified') return <>{children}</>

  return (
    <Card className="max-w-lg p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">
          {status.step === 'enroll' ? 'Thiết lập xác thực hai lớp' : 'Xác thực hai lớp'}
        </h2>
      </div>
      {status.step === 'enroll'
        ? <Enroll onVerified={check} />
        : (
          <div className="space-y-3 text-sm">
            <p>Nhập mã 6 số trong ứng dụng xác thực để vào trang quản trị.</p>
            <CodeForm factorId={status.factorId} onVerified={check} />
          </div>
        )}
    </Card>
  )
}
