import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/user-settings', () => ({
  getUserSettings: vi.fn(),
  updateOwnerNames: vi.fn(),
  normalizeOwnerNames: (n: string[]) => n,
}))

import { getUserSettings } from '@/services/user-settings'
import { SuspendedBanner } from './SuspendedBanner'

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return render(<SuspendedBanner />, { wrapper })
}

const settings = (suspendedAt: string | null) =>
  ({ ownerNames: [], privacyConsentAt: null, privacyPolicyVersion: null, suspendedAt })

beforeEach(() => vi.clearAllMocks())

describe('SuspendedBanner', () => {
  it('user bị khoá -> báo bị khoá VÀ dữ liệu vẫn được giữ (app trống vì RLS, không phải mất dữ liệu)', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(settings('2026-10-27T04:00:00.000Z'))
    renderBanner()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tài khoản đang bị tạm khoá')
    expect(alert).toHaveTextContent('vẫn được giữ nguyên')
  })

  it('không bị khoá -> không hiện gì', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(settings(null))
    const { container } = renderBanner()
    await vi.waitFor(() => expect(getUserSettings).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('chưa tải xong / lỗi tải -> không hiện (không báo khoá sai)', async () => {
    vi.mocked(getUserSettings).mockRejectedValue({ code: 'x', message: 'lỗi' })
    const { container } = renderBanner()
    await vi.waitFor(() => expect(getUserSettings).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
