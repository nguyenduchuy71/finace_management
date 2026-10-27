import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'

// Vỏ app và các trang không liên quan: stub để chỉ kiểm định tuyến /admin (lazy) trong App.
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => <Outlet /> }))
vi.mock('@/features/auth/LoginPage', () => ({ LoginPage: () => <p>LOGIN</p> }))
vi.mock('@/features/auth/SignupPage', () => ({ SignupPage: () => <p>SIGNUP</p> }))
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => <p>DASHBOARD</p> }))
vi.mock('@/pages/BankAccountsPage', () => ({ BankAccountsPage: () => <p>TRANG NGÂN HÀNG</p> }))
vi.mock('@/pages/CreditCardsPage', () => ({ CreditCardsPage: () => <p>THẺ</p> }))
vi.mock('@/pages/SettingsPage', () => ({ SettingsPage: () => <p>CÀI ĐẶT</p> }))

// Trang admin THẬT (lazy); chỉ mock service + MFA. Session do AuthProvider giả bên dưới cấp.
vi.mock('@/services/admin', () => ({
  listAdminUsers: vi.fn(), getAdminUser: vi.fn(), listAudit: vi.fn(), runAdminMutation: vi.fn(),
}))
vi.mock('@/features/auth/mfa', async (orig) => ({
  ...(await orig<typeof import('@/features/auth/mfa')>()),
  getMfaStatus: vi.fn(), startTotpEnrollment: vi.fn(), verifyTotp: vi.fn(),
}))

const auth = vi.hoisted(() => ({ session: null as unknown }))
vi.mock('@/features/auth/AuthProvider', async (orig) => {
  const real = await orig<typeof import('@/features/auth/AuthProvider')>()
  return {
    ...real,
    AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <real.AuthContext.Provider value={{ session: auth.session as never, loading: false }}>
        {children}
      </real.AuthContext.Provider>
    ),
  }
})

import { getMfaStatus } from '@/features/auth/mfa'
import { listAdminUsers, listAudit } from '@/services/admin'
import { sessionWithRole } from '@/test/fixtures/admin'
import { adminUser } from '@/test/fixtures/admin'
import { App } from './App'

// jsdom không có matchMedia; Toaster (sonner) cần nó khi mount.
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMfaStatus).mockResolvedValue({ step: 'verified' })
  vi.mocked(listAdminUsers).mockResolvedValue([adminUser({ id: 'u1', email: 'a@local.dev' })])
  vi.mocked(listAudit).mockResolvedValue([])
  window.history.pushState({}, '', '/admin')
})

describe('App — route /admin', () => {
  it('admin aal2 vào /admin -> chunk lazy tải và hiện trang quản trị', async () => {
    auth.session = sessionWithRole('admin')
    render(<App />)
    // Lần đầu phải transform chunk lazy AdminPage: cho thời gian rộng hơn 1s mặc định.
    expect(await screen.findByRole('heading', { name: 'Quản trị' }, { timeout: 8000 })).toBeInTheDocument()
    expect(await screen.findByText('a@local.dev')).toBeInTheDocument()
  })

  it('user thường gõ /admin -> bị đưa về /accounts, không gọi API admin', async () => {
    auth.session = sessionWithRole('user')
    render(<App />)
    expect(await screen.findByText('TRANG NGÂN HÀNG')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/accounts')
    expect(listAdminUsers).not.toHaveBeenCalled()
  })
})
