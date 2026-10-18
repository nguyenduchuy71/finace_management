import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/creditCards', () => ({ updateCardTransactionMcc: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { updateCardTransactionMcc } from '@/services/creditCards'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import type { CreditCardTransaction } from '@/types/creditCard'

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

const select = () => screen.getByLabelText('Phân loại MCC cho WINMART HCM') as HTMLSelectElement

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(updateCardTransactionMcc).mockResolvedValue()
})

describe('CreditCardTransactionRow — MCC', () => {
  it('chưa phân loại: select ở "Chưa phân loại MCC", liệt kê đủ 16 mã', () => {
    renderRow()
    expect(select()).toHaveValue('')
    // 16 mã + 1 mục "Chưa phân loại"
    expect(select().options).toHaveLength(17)
  })

  it('đã có MCC: select hiển thị đúng mã, không gợi ý nữa', () => {
    renderRow({ ...base, mcc: '5411' })
    expect(select()).toHaveValue('5411')
    expect(screen.queryByText(/Gợi ý:/)).not.toBeInTheDocument()
  })

  it('chọn MCC thì lưu đúng giao dịch và mã', async () => {
    const u = userEvent.setup()
    renderRow()
    await u.selectOptions(select(), '5812')
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '5812'))
  })

  it('chọn lại "Chưa phân loại" thì gửi null', async () => {
    const u = userEvent.setup()
    renderRow({ ...base, mcc: '5411' })
    await u.selectOptions(select(), '')
    await waitFor(() => expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', null))
  })

  it('merchant khớp từ khoá: hiện gợi ý nhưng KHÔNG tự lưu', () => {
    renderRow()
    expect(screen.getByRole('button', { name: /Gợi ý: 5411 · Siêu thị/ })).toBeInTheDocument()
    expect(select()).toHaveValue('')
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
    renderRow({ ...base, mcc: '5999' })
    expect(select()).toHaveValue('5999')
    expect(select().options).toHaveLength(18)
  })

  // `disabled` làm control đang focus mất focus (rơi về body): người dùng bàn phím mất vị trí.
  it('đang lưu: select KHÔNG bị disable (giữ focus), báo aria-busy, bỏ qua thay đổi thứ hai', async () => {
    const u = userEvent.setup()
    vi.mocked(updateCardTransactionMcc).mockReturnValue(new Promise(() => {}))
    renderRow()
    await u.selectOptions(select(), '5812')
    await waitFor(() => expect(select()).toHaveAttribute('aria-busy', 'true'))

    expect(select()).toBeEnabled()
    await u.selectOptions(select(), '5541')
    expect(updateCardTransactionMcc).toHaveBeenCalledTimes(1)
    expect(updateCardTransactionMcc).toHaveBeenCalledWith('tx-1', '5812')
  })

  it('merchantName rỗng: nhãn truy cập dùng mô tả, không để trống', () => {
    renderRow({ ...base, merchantName: '', description: 'GD THE 1234' })
    expect(screen.getByLabelText('Phân loại MCC cho GD THE 1234')).toBeInTheDocument()
  })
})
