import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { PRIVACY_POLICY_VERSION } from '@/types/api-key'

const auth = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))

import { AuthContext } from './AuthProvider'
import { SignupPage } from './SignupPage'

type AuthState = { session: Session | null; loading: boolean }

function renderPage(state: AuthState = { session: null, loading: false }) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/settings" element={<p>trang cài đặt</p>} />
          <Route path="/login" element={<p>trang đăng nhập</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** Điền form bằng change event (không gõ từng phím). */
function fill({ email = 'new@example.com', password = 'secret123', consent = true } = {}) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } })
  if (consent) fireEvent.click(screen.getByRole('checkbox'))
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

const NO_SESSION_OK = { data: { session: null, user: null }, error: null }

beforeEach(() => {
  vi.clearAllMocks()
  auth.signUp.mockReset()
  auth.signUp.mockResolvedValue(NO_SESSION_OK)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('SignupPage — chặn trước khi gọi signUp', () => {
  it('mật khẩu 7 ký tự -> báo lỗi, KHÔNG gọi signUp (dù đã tick đồng ý)', () => {
    renderPage()
    fill({ password: 'abcdefg' })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu tối thiểu 8 ký tự.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('mật khẩu đúng 8 ký tự là hợp lệ (biên dưới)', async () => {
    renderPage()
    fill({ password: 'abcdefgh' })
    submit()
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1))
  })

  it('chưa tick đồng ý -> báo lỗi, KHÔNG gọi signUp', () => {
    renderPage()
    fill({ consent: false })
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Cần đồng ý với cách xử lý dữ liệu để tạo tài khoản.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })
})

describe('SignupPage — liên kết pháp lý', () => {
  it('câu đồng ý dẫn tới /privacy và /terms (mở tab mới, không mất form)', () => {
    renderPage()
    const privacy = screen.getByRole('link', { name: 'Chính sách bảo mật' })
    const terms = screen.getByRole('link', { name: 'Điều khoản sử dụng' })
    expect(privacy).toHaveAttribute('href', '/privacy')
    expect(terms).toHaveAttribute('href', '/terms')
    expect(privacy).toHaveAttribute('target', '_blank')
  })
})

describe('SignupPage — gửi signUp', () => {
  it('gửi email, mật khẩu, privacy_policy_version và emailRedirectTo', async () => {
    renderPage()
    fill({ email: 'new@example.com', password: 'secret123' })
    submit()
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1))
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret123',
      options: {
        data: { privacy_policy_version: PRIVACY_POLICY_VERSION },
        emailRedirectTo: `${window.location.origin}/settings`,
      },
    })
    expect(PRIVACY_POLICY_VERSION).toBe('2026-11')
  })

  it('không có session (bật xác nhận email) -> màn "kiểm tra email" với địa chỉ đã nhập', async () => {
    renderPage()
    fill({ email: 'new@example.com' })
    submit()
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Đã gửi email xác nhận tới')
    expect(status).toHaveTextContent('new@example.com')
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull()
  })

  it('có session ngay (không cần xác nhận) -> KHÔNG hiện màn kiểm tra email', async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: 'x' }, user: {} }, error: null })
    renderPage()
    fill()
    submit()
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeEnabled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('đang gửi -> nút "Đang tạo tài khoản…" disabled', async () => {
    let finish: (v: typeof NO_SESSION_OK) => void = () => {}
    auth.signUp.mockReturnValue(new Promise((r) => { finish = r }))
    renderPage()
    fill()
    submit()
    expect(await screen.findByRole('button', { name: 'Đang tạo tài khoản…' })).toBeDisabled()
    finish(NO_SESSION_OK)
  })
})

describe('SignupPage — thông điệp lỗi từ GoTrue', () => {
  it.each<[string | undefined, string]>([
    ['signup_disabled', 'Đăng ký đang tạm đóng. Vui lòng quay lại sau.'],
    ['weak_password', 'Mật khẩu quá yếu — tối thiểu 8 ký tự, nên có chữ và số.'],
    ['over_email_send_rate_limit', 'Thử quá nhiều lần. Đợi vài phút rồi thử lại.'],
    ['over_request_rate_limit', 'Thử quá nhiều lần. Đợi vài phút rồi thử lại.'],
    ['email_address_invalid', 'Email không hợp lệ.'],
    [undefined, 'Đăng ký thất bại. Vui lòng thử lại.'],
  ])('code %s -> thông điệp "%s"', async (code, message) => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: { code, message: 'raw' } })
    renderPage()
    fill()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('email đã tồn tại KHÔNG lộ ra: không hiện "đã tồn tại", dùng thông điệp chung', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: { code: 'user_already_exists', message: 'User already registered' } })
    renderPage()
    fill()
    submit()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Đăng ký thất bại. Vui lòng thử lại.')
    expect(alert.textContent).not.toMatch(/tồn tại|đã có tài khoản|already/i)
  })

  it('mất mạng (signUp throw) -> thông điệp mạng, nút không kẹt disabled', async () => {
    auth.signUp.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    fill()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeEnabled()
  })
})

describe('SignupPage — điều hướng theo phiên', () => {
  it('auth đang tải -> không render gì', () => {
    const { container } = renderPage({ session: null, loading: true })
    expect(container).toBeEmptyDOMElement()
  })

  it('đã đăng nhập -> chuyển tới /settings', () => {
    renderPage({ session: { user: { email: 'a@b.c' } } as unknown as Session, loading: false })
    expect(screen.getByText('trang cài đặt')).toBeInTheDocument()
  })
})
