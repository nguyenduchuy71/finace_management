import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

// Chỉ mock tầng SERVICE (I/O). Hook thật (useApiKeys, useUserSettings, useUpdateOwnerNames,
// useDeleteMyAccount) và các section thật được mount. Lý do: render loop từng lọt qua
// hàng trăm test xanh vì không test nào mount hook thật (xem CLAUDE.md).
vi.mock('@/services/api-keys', () => ({
  listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn(),
}))
vi.mock('@/services/user-settings', async (orig) => ({
  ...(await orig<typeof import('@/services/user-settings')>()),
  getUserSettings: vi.fn(),
  updateOwnerNames: vi.fn(),
}))
vi.mock('@/services/account-deletion', () => ({ deleteMyAccount: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { listApiKeys } from '@/services/api-keys'
import { getUserSettings, updateOwnerNames } from '@/services/user-settings'
import { AuthContext } from '@/features/auth/AuthProvider'
import { SettingsPage } from './SettingsPage'

const SESSION = { user: { email: 'nguyen.duc.huy@example.com' } } as unknown as Session

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ session: SESSION, loading: false }}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
  render(<SettingsPage />, { wrapper })
}

/** Cho React Query/effect lắng xuống; nếu có render loop số lần gọi service sẽ tăng ở đây. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 150)) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listApiKeys).mockResolvedValue([{
    id: 'k1', name: 'iPhone', prefix: 'vj_abc123', last4: 'Wxyz',
    createdAt: '2026-10-01T10:00:00.000Z', lastUsedAt: null, revokedAt: null,
  }])
  vi.mocked(getUserSettings).mockResolvedValue({
    ownerNames: ['NGUYEN VAN A'], privacyConsentAt: null, privacyPolicyVersion: '2026-10',
  })
  vi.mocked(updateOwnerNames).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('SettingsPage — mount thật với hook thật', () => {
  it('render đủ 3 section, tải dữ liệu MỘT lần, không render loop', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Cài đặt' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'API key cho iOS Shortcut' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nhận diện chuyển khoản nội bộ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Xoá tài khoản' })).toBeInTheDocument()

    expect(await screen.findByText('iPhone')).toBeInTheDocument()
    expect(await screen.findByLabelText(/Tên chủ tài khoản/)).toHaveValue('NGUYEN VAN A')

    await settle()
    expect(listApiKeys).toHaveBeenCalledTimes(1)
    expect(getUserSettings).toHaveBeenCalledTimes(1)
  })

  it('lưu tên chủ TK: refetch đúng 1 lần, không loop, form đồng bộ với dữ liệu mới', async () => {
    vi.mocked(updateOwnerNames).mockResolvedValue(['NGUYEN VAN A', 'TRAN B'])
    renderPage()

    const textarea = await screen.findByLabelText(/Tên chủ tài khoản/)
    fireEvent.change(textarea, { target: { value: 'NGUYEN VAN A\nTRAN   B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(updateOwnerNames).toHaveBeenCalledWith(['NGUYEN VAN A', 'TRAN B']))
    await waitFor(() => expect(getUserSettings).toHaveBeenCalledTimes(2))
    await settle()
    expect(getUserSettings).toHaveBeenCalledTimes(2)
    expect(updateOwnerNames).toHaveBeenCalledTimes(1)
  })
})
