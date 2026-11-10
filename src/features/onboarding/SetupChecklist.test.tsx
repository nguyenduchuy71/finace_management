import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// Chỉ mock tầng service; hook useSetupProgress / useAccounts / useCreditCards / useApiKeys là THẬT.
vi.mock('@/services/accounts', () => ({ getAccounts: vi.fn() }))
vi.mock('@/services/creditCards', () => ({ getCreditCards: vi.fn() }))
vi.mock('@/services/api-keys', () => ({ listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn() }))
vi.mock('@/services/setup-progress', () => ({ hasReceivedAnyMessage: vi.fn() }))

import { getAccounts } from '@/services/accounts'
import { getCreditCards } from '@/services/creditCards'
import { listApiKeys } from '@/services/api-keys'
import { hasReceivedAnyMessage } from '@/services/setup-progress'
import { AuthContext } from '@/features/auth/AuthProvider'
import { sessionWithRole } from '@/test/fixtures/admin'
import { mockAccounts } from '@/test/fixtures/accounts'
import type { ApiKey } from '@/types/api-key'
import { SetupChecklist } from './SetupChecklist'

const key = (revokedAt: string | null): ApiKey => ({
  id: 'k1', name: 'iPhone', prefix: 'vj_abcdef', last4: '1234',
  createdAt: '2026-11-01T00:00:00Z', lastUsedAt: null, revokedAt,
})

function setup({ accounts = 0, keys = [] as ApiKey[], hasData = false } = {}) {
  vi.mocked(getAccounts).mockResolvedValue({ data: mockAccounts.slice(0, accounts), nextCursor: null, total: accounts })
  vi.mocked(getCreditCards).mockResolvedValue({ data: [], nextCursor: null, total: 0 })
  vi.mocked(listApiKeys).mockResolvedValue(keys)
  vi.mocked(hasReceivedAnyMessage).mockResolvedValue(hasData)
}

function renderChecklist(session = sessionWithRole(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ session, loading: false }}>
      <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
    </AuthContext.Provider>
  )
  return render(<SetupChecklist />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('SetupChecklist', () => {
  it('user mới: 0/3 bước, mỗi bước có lối đi tiếp', async () => {
    setup()
    renderChecklist()
    expect(await screen.findByText('Xong 0/3 bước — khoảng 5 phút.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thêm tài khoản' })).toHaveAttribute('href', '/accounts?view=recorded')
    expect(screen.getByRole('link', { name: 'Thêm thẻ' })).toHaveAttribute('href', '/credit-cards')
    expect(screen.getByRole('button', { name: 'Tạo API key' })).toBeInTheDocument()
  })

  it('đánh dấu bước đã xong; key đã thu hồi không tính', async () => {
    setup({ accounts: 1, keys: [key('2026-11-02T00:00:00Z')] })
    renderChecklist()
    expect(await screen.findByText('Xong 1/3 bước — khoảng 5 phút.')).toBeInTheDocument()
    expect(screen.getByText(/Thêm tài khoản ngân hàng hoặc thẻ tín dụng/)).toHaveTextContent('đã xong')
    expect(screen.queryByRole('link', { name: 'Thêm tài khoản' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo API key' })).toBeInTheDocument()
  })

  it('đã nhận tin đầu tiên -> không hiện (kể cả chủ app dùng đường legacy không có key)', async () => {
    setup({ hasData: true })
    renderChecklist()
    // Chờ MỌI truy vấn xong (không thì "không hiện" chỉ vì đang tải — test từng xanh dù bỏ điều kiện ẩn)
    await waitFor(() => {
      for (const fn of [getAccounts, getCreditCards, listApiKeys, hasReceivedAnyMessage]) expect(fn).toHaveBeenCalled()
    })
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(screen.queryByText(/Bắt đầu với/)).not.toBeInTheDocument()
  })

  it('Ẩn: nhớ theo user, mở lại không hiện và không truy vấn', async () => {
    setup()
    const { unmount } = renderChecklist()
    fireEvent.click(await screen.findByRole('button', { name: 'Ẩn hướng dẫn bắt đầu' }))
    expect(screen.queryByText(/Bắt đầu với/)).not.toBeInTheDocument()
    unmount()
    vi.clearAllMocks()
    renderChecklist()
    expect(screen.queryByText(/Bắt đầu với/)).not.toBeInTheDocument()
    expect(getAccounts).not.toHaveBeenCalled()
  })

  it('"Tạo API key" mở dialog tạo key ngay tại chỗ', async () => {
    setup({ accounts: 1 })
    renderChecklist()
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo API key' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('chưa đăng nhập -> không hiện, không truy vấn', () => {
    setup()
    renderChecklist(null as never)
    expect(screen.queryByText(/Bắt đầu với/)).not.toBeInTheDocument()
    expect(getAccounts).not.toHaveBeenCalled()
  })
})
