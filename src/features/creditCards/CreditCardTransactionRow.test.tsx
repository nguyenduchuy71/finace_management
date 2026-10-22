import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/creditCards', () => ({ updateCardTransactionMcc: vi.fn(), updateCardTransaction: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { updateCardTransaction, updateCardTransactionMcc } from '@/services/creditCards'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import type { CreditCardTransaction } from '@/types/creditCard'
import { pickMcc } from '@/test/mcc-picker-helpers'

const base: CreditCardTransaction = {
  id: 'tx-1', cardId: 'c1', amount: -150000, description: 'WINMART HCM',
  merchantName: 'WINMART HCM', type: 'purchase', status: 'posted',
  transactionDate: '2026-03-08T10:00:00Z',
}

function renderRow(tx: CreditCardTransaction = base) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(<CreditCardTransactionRow transaction={tx} />, { wrapper })
}

const LABEL = 'Phân loại MCC cho WINMART HCM'
const picker = () => screen.getByLabelText(LABEL)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(updateCardTransactionMcc).mockResolvedValue()
  vi.mocked(updateCardTransaction).mockResolvedValue()
})

describe('CreditCardTransactionRow — MCC', () => {
  it('chưa phân loại: nút chọn hiện "Chưa phân loại MCC"', () => {
    renderRow()
    expect(picker()).toHaveTextContent('Chưa phân loại MCC')
  })

  it('đã có MCC: hiển thị đúng mã, không gợi ý nữa', () => {
    renderRow({ ...base, mcc: '5411' })
    expect(picker()).toHaveTextContent('5411 · Siêu thị')
    expect(screen.queryByText(/Gợi ý:/)).not.toBeInTheDocument()
  })

  it('tìm và chọn MCC thì lưu đúng giao dịch và mã', async () => {
    const u = userEvent.setup()
    renderRow()
    await pickMcc(u, LABEL, 'nha hang', /5812 · Nhà hàng/)
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '5812'))
  })

  it('chọn được cả mã ngoài nhóm hay gặp (danh sách đầy đủ)', async () => {
    const u = userEvent.setup()
    renderRow()
    await pickMcc(u, LABEL, '7011', /7011 · Khách sạn/)
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '7011'))
  })

  it('mã 4 chữ số ngoài danh sách: chọn "Dùng mã …"', async () => {
    const u = userEvent.setup()
    renderRow()
    await pickMcc(u, LABEL, '1234', /Dùng mã 1234/)
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '1234'))
  })

  it('chọn lại "Chưa phân loại" thì gửi null', async () => {
    const u = userEvent.setup()
    renderRow({ ...base, mcc: '5411' })
    await u.click(picker())
    await u.click(screen.getByRole('option', { name: 'Chưa phân loại MCC' }))
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', null))
  })

  it('merchant khớp từ khoá: hiện gợi ý nhưng KHÔNG tự lưu', () => {
    renderRow()
    expect(screen.getByRole('button', { name: /Gợi ý: 5411 · Siêu thị/ })).toBeInTheDocument()
    expect(picker()).toHaveTextContent('Chưa phân loại MCC')
    expect(updateCardTransactionMcc).not.toHaveBeenCalled()
  })

  it('bấm gợi ý thì mới lưu mã được gợi ý', async () => {
    const u = userEvent.setup()
    renderRow()
    await u.click(screen.getByRole('button', { name: /Gợi ý: 5411/ }))
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '5411'))
  })

  it('merchant không khớp từ khoá: không có gợi ý', () => {
    renderRow({ ...base, merchantName: 'CONG TY XYZ', description: 'CONG TY XYZ' })
    expect(screen.queryByText(/Gợi ý:/)).not.toBeInTheDocument()
  })

  it('MCC lạ ngoài danh sách vẫn hiển thị, không bị nuốt thành "Chưa phân loại"', () => {
    renderRow({ ...base, mcc: '1234' })
    expect(picker()).toHaveTextContent('1234')
    expect(picker()).not.toHaveTextContent('Chưa phân loại')
  })

  // `disabled` làm control đang focus mất focus (rơi về body): người dùng bàn phím mất vị trí.
  it('đang lưu: nút chọn KHÔNG bị disable, báo aria-busy, bỏ qua lần chọn thứ hai', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCardTransactionMcc).mockReturnValue(new Promise(() => {}))
    renderRow()
    await pickMcc(u, LABEL, '5812', /5812/)
    await waitFor(() => expect(picker()).toHaveAttribute('aria-busy', 'true'))

    expect(picker()).toBeEnabled()
    await pickMcc(u, LABEL, '5541', /5541/)
    expect(updateCardTransactionMcc).toHaveBeenCalledTimes(1)
    expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '5812')
  })

  it('merchantName rỗng: nhãn truy cập dùng mô tả, không để trống', () => {
    renderRow({ ...base, merchantName: '', description: 'GD THE 1234' })
    expect(screen.getByLabelText('Phân loại MCC cho GD THE 1234')).toBeInTheDocument()
  })
})

describe('CreditCardTransactionRow — dấu số tiền', () => {
  it('chi tiêu: dấu – màu chi', () => {
    renderRow()
    const amount = screen.getByText('–đ 150.000')
    expect(amount.className).toContain('text-expense')
  })

  it('tiền vào thẻ (trả nợ/hoàn tiền): dấu + màu thu, không hiện như khoản chi', () => {
    renderRow({ ...base, amount: 5_000_000, type: 'payment', merchantName: 'GD qua NHDT' })
    const amount = screen.getByText('+đ 5.000.000')
    expect(amount.className).toContain('text-income')
    expect(screen.queryByText('–đ 5.000.000')).not.toBeInTheDocument()
  })
})

describe('CreditCardTransactionRow — sửa giao dịch', () => {
  const openEdit = async (u: ReturnType<typeof userEvent.setup>) => {
    await u.click(screen.getByRole('button', { name: 'Sửa giao dịch WINMART HCM' }))
    return screen.getByRole('dialog', { name: 'Sửa giao dịch' })
  }

  it('mở dialog điền sẵn giá trị của giao dịch', async () => {
    const u = userEvent.setup()
    renderRow({ ...base, mcc: '5411', category: 'Mua sắm' })
    await openEdit(u)
    expect(screen.getByLabelText('Nơi giao dịch')).toHaveValue('WINMART HCM')
    expect(screen.getByLabelText('Số tiền (đ)')).toHaveValue('150000')
    expect(screen.getByLabelText('Chiều tiền')).toHaveValue('expense')
    expect(screen.getByLabelText('Thời điểm')).toHaveValue('2026-03-08T17:00')
    expect(screen.getByLabelText('Danh mục')).toHaveValue('Mua sắm')
    expect(screen.getByLabelText('MCC')).toHaveTextContent('5411 · Siêu thị')
  })

  it('lưu chỉ gửi trường đã đổi, đúng giao dịch, rồi đóng dialog', async () => {
    const u = userEvent.setup()
    renderRow()
    await openEdit(u)
    fireEvent.change(screen.getByLabelText('Số tiền (đ)'), { target: { value: '200.000' } })
    fireEvent.change(screen.getByLabelText('Nơi giao dịch'), { target: { value: 'WinMart+ Q1' } })
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'Ăn uống' } })
    await u.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(updateCardTransaction).toHaveBeenCalledWith('tx-1', {
      amount: -200_000, merchantName: 'WinMart+ Q1', category: 'Ăn uống',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('đổi MCC trong dialog', async () => {
    const u = userEvent.setup()
    renderRow()
    await openEdit(u)
    await pickMcc(u, 'MCC', '7011', /7011 · Khách sạn/)
    await u.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(updateCardTransaction).toHaveBeenCalledWith('tx-1', { mcc: '7011' }))
  })

  it('không đổi gì: đóng dialog, không gọi service', async () => {
    const u = userEvent.setup()
    renderRow()
    await openEdit(u)
    await u.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateCardTransaction).not.toHaveBeenCalled()
  })

  it('dữ liệu sai: báo lỗi tại ô, không gọi service', async () => {
    const u = userEvent.setup()
    renderRow()
    await openEdit(u)
    fireEvent.change(screen.getByLabelText('Số tiền (đ)'), { target: { value: '0' } })
    await u.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Nhập số tiền lớn hơn 0')).toBeInTheDocument()
    expect(screen.getByLabelText('Số tiền (đ)')).toHaveAttribute('aria-invalid', 'true')
    expect(updateCardTransaction).not.toHaveBeenCalled()
  })

  it('lưu lỗi: giữ dialog mở và hiện lỗi từ service', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCardTransaction).mockRejectedValue({ code: 'NOT_FOUND', message: 'Không tìm thấy giao dịch.' })
    renderRow()
    await openEdit(u)
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'x' } })
    await u.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy giao dịch.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
