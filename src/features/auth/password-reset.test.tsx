import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()
const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { AuthContext } from './AuthProvider'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { LoginPage } from './LoginPage'

const recoverySession = { access_token: 't', user: { id: 'u1', email: 'an@x.vn' } } as unknown as Session

function renderAt(path: string, session: Session | null = null) {
  return render(
    <AuthContext.Provider value={{ session, loading: false }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accounts" element={<p>TRANG NGÂN HÀNG</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Quên mật khẩu', () => {
  it('trang đăng nhập có lối vào "Quên mật khẩu?"', () => {
    renderAt('/login')
    fireEvent.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }))
    expect(screen.getByRole('heading', { name: 'Quên mật khẩu' })).toBeInTheDocument()
  })

  it('gửi yêu cầu với redirect về /reset-password, báo trung tính (không lộ email có tồn tại)', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    renderAt('/forgot-password')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  an@x.vn ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Nếu an@x.vn có tài khoản')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('an@x.vn', { redirectTo: `${window.location.origin}/reset-password` })
  })

  it('giới hạn gửi EMAIL (chỉ chạm khi email có tài khoản) -> vẫn báo trung tính, không lộ email tồn tại', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit' } })
    renderAt('/forgot-password')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@x.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Nếu an@x.vn có tài khoản')
    expect(screen.getByRole('status')).toHaveFocus()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('giới hạn theo yêu cầu (trước khi tra email) -> báo đợi, vẫn ở form', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_request_rate_limit' } })
    renderAt('/forgot-password')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@x.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gửi quá nhiều lần. Đợi vài phút rồi thử lại.'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Đặt mật khẩu mới (/reset-password)', () => {
  const fill = (pw: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: pw } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: confirm } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  }

  it('không có phiên khôi phục (liên kết hết hạn / đã dùng) -> báo và mời gửi lại', () => {
    renderAt('/reset-password', null)
    expect(screen.getByRole('heading', { name: 'Liên kết không còn hiệu lực' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gửi lại liên kết' })).toHaveAttribute('href', '/forgot-password')
  })

  it('kiểm tra độ dài + khớp nhau TRƯỚC khi gọi server', () => {
    renderAt('/reset-password', recoverySession)
    fill('short', 'short')
    expect(screen.getByRole('alert')).toHaveTextContent('tối thiểu 8 ký tự')
    fill('newpassword1', 'newpassword2')
    expect(screen.getByRole('alert')).toHaveTextContent('Hai mật khẩu chưa khớp.')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('thành công -> lưu mật khẩu và vào app', async () => {
    updateUser.mockResolvedValue({ error: null })
    renderAt('/reset-password', recoverySession)
    expect(screen.getByText('an@x.vn')).toBeInTheDocument()
    fill('newpassword1', 'newpassword1')
    expect(await screen.findByText('TRANG NGÂN HÀNG')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword1' })
    expect(toast.success).toHaveBeenCalledWith('Đã đặt mật khẩu mới.')
  })

  it('trùng mật khẩu cũ -> báo rõ, ở lại form', async () => {
    updateUser.mockResolvedValue({ error: { code: 'same_password' } })
    renderAt('/reset-password', recoverySession)
    fill('oldpassword1', 'oldpassword1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu mới phải khác mật khẩu cũ.')
  })

  it('nút hiện/ẩn mật khẩu đổi kiểu ô nhập', () => {
    renderAt('/reset-password', recoverySession)
    const input = screen.getByLabelText('Mật khẩu mới')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getAllByRole('button', { name: 'Hiện mật khẩu' })[0])
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getAllByRole('button', { name: 'Hiện mật khẩu' })[0]).toHaveAttribute('aria-pressed', 'true')
  })
})
