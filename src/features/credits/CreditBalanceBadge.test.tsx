import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/services/credits', () => ({
  getCreditBalance: vi.fn(), getCreditLedger: vi.fn(), getHeldCount: vi.fn(),
}))

import { getCreditBalance, getCreditLedger, getHeldCount } from '@/services/credits'
import { CreditBalanceBadge } from './CreditBalanceBadge'
import { CreditSection } from './CreditSection'

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getHeldCount).mockResolvedValue(0)
  vi.mocked(getCreditLedger).mockResolvedValue([])
})

describe('CreditBalanceBadge', () => {
  it('hiện số dư, trỏ về /settings khi không có tin treo', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 57, unlimited: false })
    renderWith(<CreditBalanceBadge />)
    const link = await screen.findByRole('link', { name: 'Còn 57 credit' })
    expect(link).toHaveTextContent('57 credit')
    expect(link).toHaveAttribute('href', '/settings')
    expect(link.className).not.toContain('border-warning')
  })

  it('dưới ngưỡng 10 -> cảnh báo', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 9, unlimited: false })
    renderWith(<CreditBalanceBadge />)
    expect((await screen.findByRole('link')).className).toContain('border-warning')
  })

  it('đúng ngưỡng 10 -> chưa cảnh báo', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 10, unlimited: false })
    renderWith(<CreditBalanceBadge />)
    expect((await screen.findByRole('link')).className).not.toContain('border-warning')
  })

  it('có tin chờ nạp credit -> cảnh báo, đếm số tin, bấm tới hộp tin', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 0, unlimited: false })
    vi.mocked(getHeldCount).mockResolvedValue(4)
    renderWith(<CreditBalanceBadge />)
    const link = await screen.findByRole('link', { name: '4 tin đang chờ nạp credit' })
    expect(link).toHaveAttribute('href', '/accounts?view=inbox')
    expect(link).toHaveTextContent('4 chờ')
    expect(link.className).toContain('border-warning')
  })

  it('unlimited -> "Không giới hạn", không cảnh báo dù số dư 0', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 0, unlimited: true })
    renderWith(<CreditBalanceBadge />)
    const link = await screen.findByRole('link', { name: 'Không giới hạn' })
    expect(link).toHaveTextContent('Không giới hạn')
    expect(link).not.toHaveTextContent('credit')
    expect(link.className).not.toContain('border-warning')
  })

  it('chưa tải / lỗi -> ẩn (không hiện số 0 giả)', async () => {
    vi.mocked(getCreditBalance).mockRejectedValue(new Error('x'))
    renderWith(<CreditBalanceBadge />)
    await Promise.resolve()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('CreditSection', () => {
  it('hiện số dư, lịch sử và cảnh báo tin chờ', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 3, unlimited: false })
    vi.mocked(getHeldCount).mockResolvedValue(2)
    vi.mocked(getCreditLedger).mockResolvedValue([
      { id: 2, delta: -1, kind: 'usage', createdAt: '2026-10-30T10:00:00.000Z' },
      { id: 1, delta: 100, kind: 'grant', createdAt: '2026-10-29T10:00:00.000Z' },
    ])
    renderWith(<CreditSection />)
    expect(await screen.findByText('Ghi giao dịch')).toBeInTheDocument()
    expect(screen.getByText('Tặng')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('+100')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 tin đang chờ nạp credit')
  })

  it('unlimited -> "Không giới hạn" và không báo tin chờ', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 0, unlimited: true })
    vi.mocked(getHeldCount).mockResolvedValue(5)
    renderWith(<CreditSection />)
    expect(await screen.findByText('Không giới hạn')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('sổ cái trống -> thông báo', async () => {
    vi.mocked(getCreditBalance).mockResolvedValue({ balance: 0, unlimited: false })
    renderWith(<CreditSection />)
    expect(await screen.findByText('Chưa có biến động credit.')).toBeInTheDocument()
  })
})
