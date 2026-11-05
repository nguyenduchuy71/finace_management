import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Bật captcha cho cả file (không có biến env này thì form gửi như cũ — xem LoginPage/SignupPage.test).
vi.mock('@/config/captcha-config', () => ({ CAPTCHA_SITE_KEY: 'site-key-test' }))
const auth = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { AuthContext } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'
import { CAPTCHA_FAILED_MESSAGE, CAPTCHA_MISSING_MESSAGE } from './use-captcha-token'

/** Turnstile giả: ghi lại mỗi lần render để test tự "giải" captcha bằng callback. */
type Opts = { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void }
const widgets: Opts[] = []
const remove = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  widgets.length = 0
  window.turnstile = { render: (_el, opts) => { widgets.push(opts as Opts); return `w${widgets.length}` }, remove }
})
afterEach(() => { delete window.turnstile })

const solve = (token: string) => act(() => widgets.at(-1)!.callback(token))

function renderWithAuth(page: React.ReactNode) {
  render(
    <AuthContext.Provider value={{ session: null, loading: false }}>
      <MemoryRouter>{page}</MemoryRouter>
    </AuthContext.Provider>,
  )
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.vn' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

function submitSignup() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
}

describe('LoginPage — captcha bật', () => {
  it('render widget với site key; chưa giải -> báo, KHÔNG gọi đăng nhập', async () => {
    renderWithAuth(<LoginPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    expect(widgets[0].sitekey).toBe('site-key-test')
    submitLogin()
    expect(toast.error).toHaveBeenCalledWith(CAPTCHA_MISSING_MESSAGE)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('đã giải -> gửi captchaToken, sau đó mount lại widget (token chỉ dùng 1 lần)', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } })
    renderWithAuth(<LoginPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    solve('tok-1')
    submitLogin()
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@x.vn', password: 'secret123', options: { captchaToken: 'tok-1' },
    }))
    await waitFor(() => expect(widgets).toHaveLength(2))
    expect(remove).toHaveBeenCalledWith('w1')

    // Token cũ đã bị xoá: gửi lại khi chưa giải widget mới thì bị chặn.
    submitLogin()
    expect(toast.error).toHaveBeenLastCalledWith(CAPTCHA_MISSING_MESSAGE)
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1)
  })

  it('captcha_failed từ GoTrue -> thông điệp xác minh lại', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'captcha_failed' } })
    renderWithAuth(<LoginPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    solve('tok-1')
    submitLogin()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(CAPTCHA_FAILED_MESSAGE))
  })

  it('token hết hạn -> coi như chưa giải', async () => {
    renderWithAuth(<LoginPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    solve('tok-1')
    act(() => widgets[0]['expired-callback']())
    submitLogin()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('SignupPage — captcha bật', () => {
  it('chưa giải -> báo lỗi trong form, KHÔNG gọi signUp', async () => {
    renderWithAuth(<SignupPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    submitSignup()
    expect(screen.getByRole('alert')).toHaveTextContent(CAPTCHA_MISSING_MESSAGE)
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('đã giải -> captchaToken nằm trong options cùng dữ liệu đồng ý', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: { code: 'captcha_failed' } })
    renderWithAuth(<SignupPage />)
    await waitFor(() => expect(widgets).toHaveLength(1))
    solve('tok-9')
    submitSignup()
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledTimes(1))
    expect(auth.signUp.mock.calls[0][0].options).toMatchObject({ captchaToken: 'tok-9' })
    expect(await screen.findByRole('alert')).toHaveTextContent(CAPTCHA_FAILED_MESSAGE)
    // Token đã dùng: widget mount lại để lấy token mới.
    await waitFor(() => expect(widgets).toHaveLength(2))
  })
})
