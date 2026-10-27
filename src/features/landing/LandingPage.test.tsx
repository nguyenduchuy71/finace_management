import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from '@/features/auth/AuthProvider'
import { LandingPage } from './LandingPage'

function renderAt(session: Session | null, loading = false) {
  return render(
    <AuthContext.Provider value={{ session, loading }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="/accounts" element={<p>Trang giao dịch</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('LandingPage', () => {
  it('khách chưa đăng nhập thấy giới thiệu và lối vào đăng ký / đăng nhập', () => {
    renderAt(null)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tự vào sổ')
    expect(screen.getByRole('link', { name: /Tạo tài khoản miễn phí/ })).toHaveAttribute('href', '/signup')
    expect(screen.getAllByRole('link', { name: 'Đăng nhập' })[0]).toHaveAttribute('href', '/login')
    expect(screen.getByRole('list', { name: 'Ngân hàng được hỗ trợ' })).toBeInTheDocument()
  })

  it('đã đăng nhập -> vào thẳng /accounts như trước', () => {
    renderAt({ user: { id: 'u1' } } as Session)
    expect(screen.getByText('Trang giao dịch')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('đang tải phiên -> không nháy trang giới thiệu', () => {
    const { container } = renderAt(null, true)
    expect(container).toBeEmptyDOMElement()
  })
})
