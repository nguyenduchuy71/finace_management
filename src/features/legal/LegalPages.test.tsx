import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SUPPORTED_BANKS } from '@/config/supported-banks'
import { LEGAL_PLACEHOLDER } from '@/config/legal-config'
import { PRIVACY_POLICY_VERSION } from '@/types/api-key'
import PrivacyPage from './PrivacyPage'
import TermsPage from './TermsPage'

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PrivacyPage', () => {
  it('có tiêu đề, phiên bản khớp hằng số đăng ký và đủ mục chính', () => {
    renderPage(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeInTheDocument()
    expect(screen.getByText(PRIVACY_POLICY_VERSION)).toBeInTheDocument()
    for (const name of [/Dữ liệu chúng tôi thu thập/, /Thời gian lưu trữ/, /Quyền của bạn/, /Bên xử lý/]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByText(/xoá sau 30 ngày/)).toBeInTheDocument()
    expect(screen.getByText(/chỉ khi bạn tự bật trợ lý chat/)).toBeInTheDocument()
  })

  it('liệt kê đúng danh sách ngân hàng hỗ trợ', () => {
    renderPage(<PrivacyPage />)
    const items = within(screen.getByRole('list', { name: 'Ngân hàng được hỗ trợ' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([...SUPPORTED_BANKS])
  })

  it('chưa cấu hình env -> hiện marker "[chưa điền]" cho đơn vị, email, vùng dữ liệu', () => {
    renderPage(<PrivacyPage />)
    // Đơn vị (mục 1 + chân trang), email (mục 1, mục 5, chân trang), vùng dữ liệu (mục 6).
    expect(screen.getAllByText(LEGAL_PLACEHOLDER).length).toBeGreaterThanOrEqual(6)
  })

  it('có liên kết sang điều khoản và về trang chủ', () => {
    renderPage(<PrivacyPage />)
    expect(screen.getByRole('link', { name: 'Điều khoản sử dụng' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
  })
})

describe('TermsPage', () => {
  it('có chính sách hoàn credit đánh dấu rõ là chính sách chưa rà soát', () => {
    renderPage(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Chính sách hoàn credit/ })).toBeInTheDocument()
    expect(screen.getByText(/chưa qua rà soát pháp lý/)).toBeInTheDocument()
    expect(screen.getByText(/không được hoàn tiền/)).toBeInTheDocument()
  })

  it('có liên kết sang chính sách bảo mật và marker thông tin liên hệ', () => {
    renderPage(<TermsPage />)
    expect(screen.getByRole('link', { name: 'Chính sách bảo mật' })).toHaveAttribute('href', '/privacy')
    expect(screen.getAllByText(LEGAL_PLACEHOLDER).length).toBeGreaterThanOrEqual(3)
  })
})
