import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/cashbackRules', () => ({
  listCashbackRules: vi.fn(),
  createCashbackRule: vi.fn(),
  updateCashbackRule: vi.fn(),
  deleteCashbackRule: vi.fn(),
  getCycleExpenses: vi.fn(),
  setCardCashbackCap: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import {
  listCashbackRules, createCashbackRule, updateCashbackRule, setCardCashbackCap,
} from '@/services/cashbackRules'
import { CashbackRulesEditor } from './CashbackRulesEditor'
import type { CashbackRule } from '@/types/cashback'
import type { CreditCard } from '@/types/creditCard'

const card: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265', cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  cashbackMonthlyCap: null,
  lastUpdated: '2026-01-01T00:00:00Z',
}
const laddered: CashbackRule = {
  id: 'r-super', cardId: 'card-1', mcc: '5411', ratePercent: 0.5, minCycleSpend: 5_000_000, capPerCycle: null,
  tiers: [{ minSpend: 10_000_000, ratePercent: 1 }, { minSpend: 20_000_000, ratePercent: 1.5 }],
}

function renderEditor(c: CreditCard = card) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  render(<CashbackRulesEditor card={c} open onOpenChange={vi.fn()} />, { wrapper })
}

const setField = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const value = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listCashbackRules).mockResolvedValue([])
})

async function openNewRule() {
  renderEditor()
  const add = await screen.findByRole('button', { name: 'Thêm rule' })
  await waitFor(() => expect(add).toBeEnabled()) // bị khoá tới khi tải xong danh sách rule
  fireEvent.click(add)
}

describe('CashbackRuleForm — bậc thang', () => {
  it('thêm hai bậc và gửi giá trị đã chuẩn hoá', async () => {
    await openNewRule()
    vi.mocked(createCashbackRule).mockResolvedValue(laddered)
    setField('Hoàn (%)', '0,5')
    setField(/Chi tối thiểu/, '5.000.000')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    setField('Bậc 1: chi từ (đ)', '10.000.000')
    setField('Bậc 1: hoàn (%)', '1')
    setField('Bậc 2: chi từ (đ)', '20000000')
    setField('Bậc 2: hoàn (%)', '1,5')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm rule' }))

    await waitFor(() => expect(createCashbackRule).toHaveBeenCalledWith('card-1', expect.objectContaining({
      minCycleSpend: 5_000_000,
      tiers: [{ minSpend: 10_000_000, ratePercent: 1 }, { minSpend: 20_000_000, ratePercent: 1.5 }],
    })))
  })

  it('xoá bậc ở giữa không làm lệch giá trị của các bậc còn lại', async () => {
    await openNewRule()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    setField('Bậc 1: chi từ (đ)', '1000'); setField('Bậc 1: hoàn (%)', '1')
    setField('Bậc 2: chi từ (đ)', '2000'); setField('Bậc 2: hoàn (%)', '2')
    setField('Bậc 3: chi từ (đ)', '3000'); setField('Bậc 3: hoàn (%)', '3')

    fireEvent.click(screen.getByRole('button', { name: 'Xoá bậc 2' }))

    expect(screen.queryByLabelText('Bậc 3: chi từ (đ)')).not.toBeInTheDocument()
    expect([value('Bậc 1: chi từ (đ)'), value('Bậc 1: hoàn (%)')]).toEqual(['1000', '1'])
    expect([value('Bậc 2: chi từ (đ)'), value('Bậc 2: hoàn (%)')]).toEqual(['3000', '3'])
  })

  it('lỗi hiện đúng dòng vi phạm và không gọi service', async () => {
    await openNewRule()
    setField('Hoàn (%)', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    setField('Bậc 1: chi từ (đ)', '10.000.000'); setField('Bậc 1: hoàn (%)', '1')
    setField('Bậc 2: chi từ (đ)', '10.000.000'); setField('Bậc 2: hoàn (%)', '2')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm rule' }))

    const input = screen.getByLabelText('Bậc 2: chi từ (đ)')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/lớn hơn mức chi của bậc trước/)
    expect(screen.getByLabelText('Bậc 1: chi từ (đ)')).not.toHaveAttribute('aria-invalid')
    expect(createCashbackRule).not.toHaveBeenCalled()
  })

  it('dòng bậc để trống bị báo lỗi, không bị bỏ qua im lặng', async () => {
    await openNewRule()
    setField('Hoàn (%)', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm rule' }))
    expect(screen.getByText('Nhập mức chi')).toBeInTheDocument()
    expect(createCashbackRule).not.toHaveBeenCalled()
  })

  it('đủ 5 bậc thì ẩn nút Thêm bậc; xoá bớt thì hiện lại', async () => {
    await openNewRule()
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Thêm bậc' }))
    expect(screen.queryByRole('button', { name: 'Thêm bậc' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bậc 5' }))
    expect(screen.getByRole('button', { name: 'Thêm bậc' })).toBeInTheDocument()
  })

  it('sửa rule: điền sẵn các bậc, đổi một bậc rồi gửi đủ danh sách mới', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([laddered])
    vi.mocked(updateCashbackRule).mockResolvedValue(laddered)
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: /Sửa rule/ }))
    expect([value('Bậc 1: chi từ (đ)'), value('Bậc 1: hoàn (%)')]).toEqual(['10000000', '1'])
    expect([value('Bậc 2: chi từ (đ)'), value('Bậc 2: hoàn (%)')]).toEqual(['20000000', '1.5'])

    setField('Bậc 2: hoàn (%)', '2')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu rule' }))
    await waitFor(() => expect(updateCashbackRule).toHaveBeenCalledWith('card-1', 'r-super', expect.objectContaining({
      tiers: [{ minSpend: 10_000_000, ratePercent: 1 }, { minSpend: 20_000_000, ratePercent: 2 }],
    })))
  })

  it('xoá hết bậc rồi lưu gửi danh sách rỗng', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([laddered])
    vi.mocked(updateCashbackRule).mockResolvedValue({ ...laddered, tiers: [] })
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: /Sửa rule/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bậc 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bậc 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu rule' }))
    await waitFor(() => expect(updateCashbackRule).toHaveBeenCalledWith('card-1', 'r-super', expect.objectContaining({ tiers: [] })))
  })

  it('lỗi từ server (bậc sai) hiện nguyên thông điệp và giữ form để sửa', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([laddered])
    vi.mocked(updateCashbackRule).mockRejectedValue({ code: '22023', message: 'Bậc 2: mức chi phải lớn hơn bậc trước (hoặc ngưỡng nền)' })
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: /Sửa rule/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu rule' }))
    expect(await screen.findByText(/Bậc 2: mức chi phải lớn hơn bậc trước/)).toBeInTheDocument()
    expect(screen.getByLabelText('Bậc 1: chi từ (đ)')).toBeInTheDocument()
  })

  it('danh sách rule mô tả các bậc', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([laddered])
    renderEditor()
    expect(await screen.findByText(/bậc: từ .*10\.000\.000.* hoàn 1%, từ .*20\.000\.000.* hoàn 1\.5%/)).toBeInTheDocument()
  })
})

describe('CardCashbackCapField — trần hoàn tiền cả thẻ', () => {
  it('điền sẵn trần hiện có của thẻ', async () => {
    renderEditor({ ...card, cashbackMonthlyCap: 600_000 })
    expect(await screen.findByLabelText(/Trần hoàn tiền cả thẻ/)).toHaveValue('600000')
  })

  it('lưu trần đã chuẩn hoá cho đúng thẻ', async () => {
    vi.mocked(setCardCashbackCap).mockResolvedValue()
    renderEditor()
    await screen.findByLabelText(/Trần hoàn tiền cả thẻ/)
    setField(/Trần hoàn tiền cả thẻ/, '600.000')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trần' }))
    await waitFor(() => expect(setCardCashbackCap).toHaveBeenCalledWith('card-1', 600_000))
  })

  it('để trống rồi lưu = bỏ trần (null)', async () => {
    vi.mocked(setCardCashbackCap).mockResolvedValue()
    renderEditor({ ...card, cashbackMonthlyCap: 600_000 })
    await screen.findByLabelText(/Trần hoàn tiền cả thẻ/)
    setField(/Trần hoàn tiền cả thẻ/, '')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trần' }))
    await waitFor(() => expect(setCardCashbackCap).toHaveBeenCalledWith('card-1', null))
  })

  it('"0" và số sai định dạng bị chặn, không gọi service', async () => {
    renderEditor()
    await screen.findByLabelText(/Trần hoàn tiền cả thẻ/)
    setField(/Trần hoàn tiền cả thẻ/, '0')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trần' }))
    expect(screen.getByText(/phải lớn hơn 0/)).toBeInTheDocument()
    setField(/Trần hoàn tiền cả thẻ/, '1,5')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trần' }))
    expect(screen.getByLabelText(/Trần hoàn tiền cả thẻ/)).toHaveAttribute('aria-invalid', 'true')
    expect(setCardCashbackCap).not.toHaveBeenCalled()
  })

  it('lỗi từ service hiện tại chỗ', async () => {
    vi.mocked(setCardCashbackCap).mockRejectedValue({ code: 'NOT_FOUND', message: 'Không tìm thấy thẻ' })
    renderEditor()
    await screen.findByLabelText(/Trần hoàn tiền cả thẻ/)
    setField(/Trần hoàn tiền cả thẻ/, '100000')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trần' }))
    expect(await screen.findByText('Không tìm thấy thẻ')).toBeInTheDocument()
  })
})
