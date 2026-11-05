import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { AuthContext } from './AuthProvider'
import { LoginPage } from './LoginPage'

function submit() {
  // Context mặc định có loading = true -> LoginPage render rỗng; giả lập đã tải xong, chưa đăng nhập.
  render(
    <AuthContext.Provider value={{ session: null, loading: false }}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </AuthContext.Provider>,
  )
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.vn' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

beforeEach(() => vi.clearAllMocks())

describe('LoginPage — thông điệp lỗi', () => {
  it('user_banned -> báo bị khoá, KHÔNG bảo kiểm tra mật khẩu', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'user_banned', message: 'User is banned' } })
    submit()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tài khoản đang bị tạm khoá. Liên hệ quản trị để được mở khoá.'))
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('sai mật khẩu -> thông điệp kiểm tra email và mật khẩu', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'x' } })
    submit()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.'))
  })
})

describe('LoginPage — liên kết pháp lý', () => {
  it('có liên kết tới /privacy và /terms', () => {
    render(
      <AuthContext.Provider value={{ session: null, loading: false }}>
        <MemoryRouter><LoginPage /></MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('link', { name: 'Chính sách bảo mật' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Điều khoản sử dụng' })).toHaveAttribute('href', '/terms')
  })
})
