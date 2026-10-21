import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'

// Mount THẬT cả trang với hook + store thật (chỉ mock tầng service): một render loop
// từng lọt qua hàng trăm test xanh vì không test nào mount component dùng hook thật.
vi.mock('@/services/unparsed-messages', () => ({
  UNPARSED_PAGE_LIMIT: 200,
  getUnparsedMessages: vi.fn(),
  getUnparsedCount: vi.fn(),
  resolveUnparsed: vi.fn(),
}))
vi.mock('@/services/accounts', () => ({ getAccounts: vi.fn(), getTransactions: vi.fn() }))
vi.mock('@/services/account-mutations', () => ({
  createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn(), countAccountTransactions: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getUnparsedCount, getUnparsedMessages } from '@/services/unparsed-messages'
import { getAccounts, getTransactions } from '@/services/accounts'
import { createAccount } from '@/services/account-mutations'
import { useFilterStore } from '@/stores/filterStore'
import { mockAccounts } from '@/test/fixtures/accounts'
import { BankAccountsPage } from './BankAccountsPage'

function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>
}

function renderPage(path = '/accounts') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BankAccountsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useFilterStore.setState({ accountId: null })
  vi.mocked(getUnparsedMessages).mockResolvedValue({ data: [], total: 0 })
  vi.mocked(getUnparsedCount).mockResolvedValue(3)
  vi.mocked(getAccounts).mockResolvedValue({ data: [], nextCursor: null, total: 0 })
  vi.mocked(getTransactions).mockResolvedValue({ data: [], nextCursor: null, total: 0 })
})

describe('BankAccountsPage', () => {
  it('mặc định mở "Chưa phân loại" kèm badge số tin', async () => {
    renderPage()
    expect(await screen.findByText('Không còn tin nào cần phân loại')).toBeInTheDocument()
    expect(await screen.findByLabelText('3 tin chưa phân loại')).toHaveTextContent('3')
    expect(getAccounts).not.toHaveBeenCalled() // mục "Đã ghi nhận" chưa mở thì chưa tải
  })

  it('chuyển sang "Đã ghi nhận" ghi ?view=recorded; chưa có TK -> mời thêm', async () => {
    const u = userEvent.setup()
    renderPage()
    await u.click(screen.getByRole('tab', { name: 'Đã ghi nhận' }))
    expect(await screen.findByText('Chưa có tài khoản ngân hàng nào')).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent('?view=recorded')
  })

  it('mở thẳng ?view=recorded: chọn TK đầu tiên và tải giao dịch của nó', async () => {
    vi.mocked(getAccounts).mockResolvedValue({ data: mockAccounts, nextCursor: null, total: mockAccounts.length })
    renderPage('/accounts?view=recorded')
    expect(await screen.findByRole('tab', { name: /Vietcombank/ })).toBeInTheDocument()
    await waitFor(() => expect(getTransactions).toHaveBeenCalledWith('vcb-checking-001', undefined, expect.any(Number), expect.anything()))
    expect(screen.getByRole('button', { name: 'Sửa tài khoản đang chọn' })).toBeInTheDocument()
  })

  it('thêm tài khoản: chuẩn hoá tên ngân hàng, gửi giá trị đã validate, chọn TK vừa tạo', async () => {
    const u = userEvent.setup()
    vi.mocked(createAccount).mockResolvedValue({ ...mockAccounts[0], id: 'new-acc' })
    renderPage('/accounts?view=recorded')
    await u.click(await screen.findByRole('button', { name: /Thêm tài khoản đầu tiên/ }))
    fireEvent.change(screen.getByLabelText('Ngân hàng'), { target: { value: 'vietinbank' } })
    fireEvent.change(screen.getByLabelText('Tên tài khoản'), { target: { value: 'TK lương' } })
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '104800004982' } })
    await u.click(screen.getByRole('button', { name: 'Thêm tài khoản' }))
    expect(await screen.findByText(/Nhập dạng \*\*\*\*4982/)).toBeInTheDocument()
    expect(createAccount).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '****4982' } })
    await u.click(screen.getByRole('button', { name: 'Thêm tài khoản' }))
    await waitFor(() => expect(createAccount).toHaveBeenCalledWith({
      bankName: 'Vietinbank', accountName: 'TK lương', accountNumber: '****4982', accountType: 'checking', balance: 0,
    }))
    await waitFor(() => expect(useFilterStore.getState().accountId).toBe('new-acc'))
  })
})
