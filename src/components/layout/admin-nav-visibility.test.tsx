import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/features/unparsed/UnparsedCountBadge', () => ({ UnparsedCountBadge: () => null }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

import { AuthContext } from '@/features/auth/AuthProvider'
import { sessionWithRole } from '@/test/fixtures/admin'
import { NAV_ITEMS, visibleNavItems } from './nav-items'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'

function withRole(role: string | undefined, ui: ReactNode) {
  return (
    <AuthContext.Provider value={{ session: sessionWithRole(role), loading: false }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('visibleNavItems', () => {
  it('user thường: không có mục adminOnly (/admin)', () => {
    const paths = visibleNavItems(false).map((i) => i.to)
    expect(paths).not.toContain('/admin')
    expect(paths).toEqual(['/dashboard', '/accounts', '/credit-cards', '/settings'])
  })

  it('admin: có thêm "Quản trị" ở cuối', () => {
    const items = visibleNavItems(true)
    expect(items.at(-1)).toMatchObject({ to: '/admin', label: 'Quản trị' })
    expect(items).toHaveLength(NAV_ITEMS.length)
  })

  it('chỉ đúng mục /admin được đánh dấu adminOnly', () => {
    expect(NAV_ITEMS.filter((i) => i.adminOnly).map((i) => i.to)).toEqual(['/admin'])
  })
})

describe('AppHeader — mục Quản trị', () => {
  it('admin thấy link Quản trị trỏ /admin', () => {
    render(withRole('admin', <AppHeader />))
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', '/admin')
  })

  it('user thường KHÔNG thấy link Quản trị, vẫn thấy các mục khác', () => {
    render(withRole('user', <AppHeader />))
    expect(screen.queryByRole('link', { name: 'Quản trị' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ngân hàng' })).toBeInTheDocument()
  })
})

describe('MobileTabBar — mục Quản trị', () => {
  it('admin: có Quản trị, lưới 5 cột', () => {
    render(withRole('admin', <MobileTabBar />))
    expect(screen.getByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('list')).toHaveStyle({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' })
  })

  it('user thường: không có Quản trị, lưới 4 cột', () => {
    render(withRole('user', <MobileTabBar />))
    expect(screen.queryByRole('link', { name: 'Quản trị' })).toBeNull()
    expect(screen.getByRole('list')).toHaveStyle({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' })
  })
})
