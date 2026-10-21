import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/unparsed-messages', () => ({
  UNPARSED_PAGE_LIMIT: 200,
  getUnparsedMessages: vi.fn(),
  getUnparsedCount: vi.fn(),
  resolveUnparsed: vi.fn(),
}))
vi.mock('@/services/accounts', () => ({ getAccounts: vi.fn() }))
vi.mock('@/services/creditCards', () => ({ getCreditCards: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getUnparsedMessages, resolveUnparsed } from '@/services/unparsed-messages'
import { getAccounts } from '@/services/accounts'
import { getCreditCards } from '@/services/creditCards'
import { mockAccounts } from '@/test/fixtures/accounts'
import { mockCreditCards } from '@/test/fixtures/creditCards'
import { UnparsedInbox } from './UnparsedInbox'
import type { UnparsedMessage } from '@/types/unparsed'

const TX_MSG: UnparsedMessage = {
  id: 'm1',
  // đuôi 1234 = mockAccounts[0] (Vietcombank ****1234)
  rawText: 'Tin biến động số dư\nThời gian: 20/10/2026 17:32\nTài khoản: 104800001234\nGiao dịch: -79,000 VND',
  source: 'Vietcombank',
  receivedAt: '2026-10-20T10:33:00.000Z',
  suggestedKind: 'transaction',
}
const REMINDER: UnparsedMessage = {
  id: 'm2', rawText: 'Tong du no: 1,219,710 VND', source: null,
  receivedAt: '2026-10-20T09:00:00.000Z', suggestedKind: 'card_reminder',
}

function renderInbox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(<UnparsedInbox />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUnparsedMessages).mockResolvedValue({ data: [TX_MSG, REMINDER], total: 2 })
  vi.mocked(getAccounts).mockResolvedValue({ data: mockAccounts, nextCursor: null, total: mockAccounts.length })
  vi.mocked(getCreditCards).mockResolvedValue({ data: mockCreditCards, nextCursor: null, total: mockCreditCards.length })
  vi.mocked(resolveUnparsed).mockResolvedValue('tx-1')
})
afterEach(() => vi.restoreAllMocks())

describe('UnparsedInbox', () => {
  it('hiện tin + gợi ý; mặc định ẩn quảng cáo, bật checkbox thì tải cả quảng cáo', async () => {
    renderInbox()
    expect(await screen.findByText(/Giao dịch: -79,000 VND/)).toBeInTheDocument()
    expect(screen.getByText('Có vẻ là giao dịch')).toBeInTheDocument()
    expect(getUnparsedMessages).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByLabelText('Hiện cả tin quảng cáo'))
    await waitFor(() => expect(getUnparsedMessages).toHaveBeenLastCalledWith(true))
  })

  it('hộp trống -> thông báo đã xử lý hết', async () => {
    vi.mocked(getUnparsedMessages).mockResolvedValue({ data: [], total: 0 })
    renderInbox()
    expect(await screen.findByText('Không còn tin nào cần phân loại')).toBeInTheDocument()
  })

  it('đánh dấu nhắc thẻ cần xác nhận; huỷ thì không gọi RPC', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderInbox()
    const item = (await screen.findByText(/Tong du no/)).closest('li')!
    const btn = within(item).getByRole('button', { name: 'Nhắc thanh toán thẻ' })

    fireEvent.click(btn)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(resolveUnparsed).not.toHaveBeenCalled()

    fireEvent.click(btn)
    await waitFor(() => expect(resolveUnparsed).toHaveBeenCalledWith('m2', 'card_reminder', undefined))
  })

  it('ghi thành giao dịch: điền sẵn số tiền/thời điểm, chọn sẵn TK khớp đuôi, gửi số âm + offset +07:00', async () => {
    const u = userEvent.setup()
    renderInbox()
    const item = (await screen.findByText(/Giao dịch: -79,000 VND/)).closest('li')!
    await u.click(within(item).getByRole('button', { name: 'Ghi thành giao dịch' }))

    const dialog = await screen.findByRole('dialog')
    // form chỉ dựng sau khi TK/thẻ tải xong -> nguồn tiền được chọn sẵn kể cả khi cache trống
    expect(await within(dialog).findByLabelText('Số tiền (đ)')).toHaveValue('79000')
    expect(within(dialog).getByLabelText('Thời điểm')).toHaveValue('2026-10-20T17:32')
    expect(within(dialog).getByLabelText('Tài khoản / thẻ')).toHaveValue('account:vcb-checking-001')
    expect(within(dialog).getByLabelText('Chiều tiền')).toHaveValue('expense')

    fireEvent.change(within(dialog).getByLabelText('Loại'), { target: { value: 'internal_transfer' } })
    expect(within(dialog).getByText(/KHÔNG tính vào thu\/chi/)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Ghi giao dịch' }))

    await waitFor(() => expect(resolveUnparsed).toHaveBeenCalledWith('m1', 'internal_transfer', {
      amount: -79000, transactionDate: '2026-10-20T17:32:00+07:00', accountId: 'vcb-checking-001',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('chưa chọn nguồn tiền -> báo lỗi tại ô, không gọi RPC', async () => {
    const u = userEvent.setup()
    vi.mocked(getUnparsedMessages).mockResolvedValue({ data: [REMINDER], total: 1 })
    renderInbox()
    const item = (await screen.findByText(/Tong du no/)).closest('li')!
    await u.click(within(item).getByRole('button', { name: 'Ghi thành giao dịch' }))
    const dialog = await screen.findByRole('dialog')
    await u.click(await within(dialog).findByRole('button', { name: 'Ghi giao dịch' }))
    expect(await within(dialog).findByText('Chọn tài khoản hoặc thẻ')).toBeInTheDocument()
    expect(resolveUnparsed).not.toHaveBeenCalled()
  })

  it('RPC lỗi -> giữ dialog và hiện thông điệp', async () => {
    const u = userEvent.setup()
    vi.mocked(resolveUnparsed).mockRejectedValue({ code: '22023', message: 'Tin đã được xử lý hoặc dữ liệu giao dịch không hợp lệ.' })
    renderInbox()
    const item = (await screen.findByText(/Giao dịch: -79,000 VND/)).closest('li')!
    await u.click(within(item).getByRole('button', { name: 'Ghi thành giao dịch' }))
    const dialog = await screen.findByRole('dialog')
    await u.click(await within(dialog).findByRole('button', { name: 'Ghi giao dịch' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('đã được xử lý')
  })
})
