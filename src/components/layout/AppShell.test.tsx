import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mount THẬT AppShell (header + thanh tab + chat) — chỉ mock tầng service/client.
vi.mock('@/services/unparsed-messages', () => ({
  UNPARSED_PAGE_LIMIT: 200,
  getUnparsedMessages: vi.fn(),
  getUnparsedCount: vi.fn(),
  resolveUnparsed: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

import { getUnparsedCount } from '@/services/unparsed-messages'
import { AppShell } from './AppShell'

function renderShell(path = '/credit-cards') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<p>nội dung trang</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUnparsedCount).mockResolvedValue(7)
})

describe('AppShell — điều hướng', () => {
  it('header và thanh tab dưới cùng render đủ 3 mục từ cùng một nguồn', () => {
    renderShell()
    const navs = screen.getAllByRole('navigation', { name: 'Điều hướng chính' })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link')
      expect(links.map((l) => l.getAttribute('href'))).toEqual(['/dashboard', '/accounts', '/credit-cards'])
    }
  })

  it('đánh dấu mục đang mở bằng aria-current ở cả hai thanh', () => {
    renderShell('/credit-cards')
    for (const nav of screen.getAllByRole('navigation', { name: 'Điều hướng chính' })) {
      expect(within(nav).getByRole('link', { name: /Thẻ tín dụng/ })).toHaveAttribute('aria-current', 'page')
      expect(within(nav).getByRole('link', { name: /Tổng quan/ })).not.toHaveAttribute('aria-current')
    }
  })

  it('hiện số tin chưa phân loại trên mục Ngân hàng của thanh tab dưới', async () => {
    renderShell()
    const [, tabBar] = screen.getAllByRole('navigation', { name: 'Điều hướng chính' })
    expect(await within(tabBar).findByLabelText('7 tin chưa phân loại')).toBeInTheDocument()
  })

  it('render nội dung trang con qua Outlet', () => {
    renderShell()
    expect(screen.getByText('nội dung trang')).toBeInTheDocument()
  })
})
