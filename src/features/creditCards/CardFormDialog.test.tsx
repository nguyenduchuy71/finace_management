import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/credit-card-mutations', () => ({
  createCreditCard: vi.fn(),
  updateCreditCard: vi.fn(),
  deleteCreditCard: vi.fn(),
  countCardTransactions: vi.fn(),
}))
vi.mock('@/services/accounts', () => ({ getUnlinkedCount: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { createCreditCard, updateCreditCard } from '@/services/credit-card-mutations'
import { getUnlinkedCount } from '@/services/accounts'
import { useFilterStore } from '@/stores/filterStore'
import { CardFormDialog } from './CardFormDialog'
import type { CreditCard } from '@/types/creditCard'

const existing: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265',
  cardType: 'mastercard', currency: 'VND', creditLimit: 12000000, currentBalance: 0,
  statementDate: 9, paymentDueDate: 29, cashbackMonthlyCap: null, lastUpdated: '2026-01-01T00:00:00Z',
}

function renderDialog(card: CreditCard | null = null) {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  render(<CardFormDialog open onOpenChange={onOpenChange} card={card} />, { wrapper })
  return { onOpenChange }
}

/**
 * Điền ô bằng một sự kiện change thay vì gõ từng phím: gõ ~40 ký tự bằng userEvent mất ~0,4s
 * khi chạy riêng nhưng chậm gấp chục lần khi cả bộ test chạy song song, đủ để vượt timeout 5s.
 * Chỉ test nào kiểm hành vi GÕ PHÍM mới dùng u.type.
 */
const setField = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillValid() {
  setField('Ngân hàng', 'LPBank')
  setField('Tên thẻ', 'LPBank Visa')
  setField('Số thẻ', '****x265')
  setField('Ngày sao kê (1-31)', '5')
  setField('Ngày đến hạn (1-31)', '25')
  setField('Hạn mức (đ)', '50.000.000')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getUnlinkedCount).mockResolvedValue(0)
  useFilterStore.setState({ cardId: null })
})

describe('CardFormDialog — thêm thẻ', () => {
  it('mở ra form trống với tiêu đề thêm mới', () => {
    renderDialog()
    expect(screen.getByText('Thêm thẻ tín dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('Ngân hàng')).toHaveValue('')
    expect(screen.getByLabelText('Loại thẻ')).toHaveValue('visa')
  })

  it('số thẻ sai định dạng bị chặn, không gọi service', async () => {
    const u = userEvent.setup()
    renderDialog()
    fillValid()
    setField('Số thẻ', '5678')
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    expect(await screen.findByText(/Nhập dạng \*\*\*\*x265/)).toBeInTheDocument()
    expect(createCreditCard).not.toHaveBeenCalled()
  })

  it('gửi giá trị đã chuẩn hoá, chọn thẻ mới và đóng dialog', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockResolvedValue({ ...existing, id: 'new-card' })
    const { onOpenChange } = renderDialog()
    fillValid()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(createCreditCard).toHaveBeenCalledWith({
      bankName: 'LPBank', cardName: 'LPBank Visa', cardNumber: '****x265', cardType: 'visa',
      statementDate: 5, paymentDueDate: 25, creditLimit: 50000000,
    })
    expect(useFilterStore.getState().cardId).toBe('new-card')
  })

  // Edge function so khớp bank_name bằng .eq() chính xác; "lpbank" làm mọi giao dịch mất liên kết.
  it('chuẩn hoá hoa/thường tên ngân hàng đã biết trước khi gửi', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockResolvedValue(existing)
    const { onOpenChange } = renderDialog()
    fillValid()
    setField('Ngân hàng', 'lpbank')
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(createCreditCard).toHaveBeenCalledWith(expect.objectContaining({ bankName: 'LPBank' }))
  })

  it('ngân hàng chưa biết được giữ nguyên (thẻ của bank chưa có parser vẫn hợp lệ)', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockResolvedValue(existing)
    const { onOpenChange } = renderDialog()
    fillValid()
    setField('Ngân hàng', 'Some New Bank')
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(createCreditCard).toHaveBeenCalledWith(expect.objectContaining({ bankName: 'Some New Bank' }))
  })

  it('hạn mức sai nhóm nghìn bị chặn thay vì lưu sai số', async () => {
    const u = userEvent.setup()
    renderDialog()
    fillValid()
    setField('Hạn mức (đ)', '1.5')
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    expect(await screen.findByText(/Hạn mức sai định dạng/)).toBeInTheDocument()
    expect(createCreditCard).not.toHaveBeenCalled()
  })

  it('ô lỗi có aria-invalid nối với thông báo; sửa ô đó thì lỗi biến mất', async () => {
    const u = userEvent.setup()
    renderDialog()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    const number = screen.getByLabelText('Số thẻ')
    expect(number).toHaveAttribute('aria-invalid', 'true')
    expect(number).toHaveAttribute('aria-describedby', 'card-number-error')
    expect(document.getElementById('card-number-error')).toHaveTextContent(/Nhập dạng/)

    await u.type(number, '*')
    expect(number).not.toHaveAttribute('aria-invalid')
    expect(document.getElementById('card-number-error')).toBeNull()
    // lỗi của các ô khác không bị xoá theo
    expect(screen.getByLabelText('Ngân hàng')).toHaveAttribute('aria-invalid', 'true')
  })

  it('đang lưu thì Esc không đóng dialog; lưu xong mới đóng', async () => {
    const u = userEvent.setup()
    let resolveCreate!: (c: CreditCard) => void
    vi.mocked(createCreditCard).mockReturnValue(new Promise((r) => { resolveCreate = r }))
    const { onOpenChange } = renderDialog()
    fillValid()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toBeDisabled()

    await u.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()

    resolveCreate(existing)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('báo thẻ trùng bằng thông điệp riêng và giữ dialog mở', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockRejectedValue({ code: '23505', message: 'Dữ liệu đã tồn tại.' })
    const { onOpenChange } = renderDialog()
    fillValid()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    expect(await screen.findByText(/Thẻ này đã tồn tại/)).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('cảnh báo khi có giao dịch chưa gắn thẻ sau khi thêm', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockResolvedValue(existing)
    vi.mocked(getUnlinkedCount).mockResolvedValue(3)
    renderDialog()
    fillValid()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    await waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toContain('3 giao dịch chưa gắn')
  })

  it('không cảnh báo khi mọi giao dịch đã được gắn', async () => {
    const u = userEvent.setup()
    vi.mocked(createCreditCard).mockResolvedValue(existing)
    const { onOpenChange } = renderDialog()
    fillValid()
    await u.click(screen.getByRole('button', { name: 'Thêm thẻ' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await waitFor(() => expect(getUnlinkedCount).toHaveBeenCalled())
    expect(toast.warning).not.toHaveBeenCalled()
  })
})

describe('CardFormDialog — sửa thẻ', () => {
  it('điền sẵn giá trị của thẻ và gọi update với id đúng', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCreditCard).mockResolvedValue(existing)
    const { onOpenChange } = renderDialog(existing)

    expect(screen.getByText('Sửa thẻ tín dụng')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên thẻ')).toHaveValue('SHB Visa')
    expect(screen.getByLabelText('Loại thẻ')).toHaveValue('mastercard')
    expect(screen.getByLabelText('Ngày sao kê (1-31)')).toHaveValue('9')

    setField('Tên thẻ', 'SHB Platinum')
    await u.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(updateCreditCard).toHaveBeenCalledWith('card-1', expect.objectContaining({
      cardName: 'SHB Platinum', statementDate: 9, paymentDueDate: 29, creditLimit: 12000000,
    }))
    expect(createCreditCard).not.toHaveBeenCalled()
  })

  // Chỉ ngân hàng + số thẻ ảnh hưởng việc gắn giao dịch.
  it('đổi tên thẻ/hạn mức: không đếm giao dịch chưa gắn', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCreditCard).mockResolvedValue(existing)
    const { onOpenChange } = renderDialog(existing)
    await u.type(screen.getByLabelText('Hạn mức (đ)'), '0')
    await u.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(getUnlinkedCount).not.toHaveBeenCalled()
  })

  it('đổi số thẻ: đếm giao dịch chưa gắn để cảnh báo', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCreditCard).mockResolvedValue(existing)
    vi.mocked(getUnlinkedCount).mockResolvedValue(2)
    renderDialog(existing)
    setField('Số thẻ', '****y999')
    await u.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(toast.warning).toHaveBeenCalled())
    expect(updateCreditCard).toHaveBeenCalledWith('card-1', expect.objectContaining({ cardNumber: '****y999' }))
  })
})
