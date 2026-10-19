import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/cashbackRules', () => ({
  listCashbackRules: vi.fn(),
  createCashbackRule: vi.fn(),
  updateCashbackRule: vi.fn(),
  deleteCashbackRule: vi.fn(),
  getCycleExpenses: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import {
  listCashbackRules, createCashbackRule, updateCashbackRule, deleteCashbackRule,
} from '@/services/cashbackRules'
import { CashbackRulesEditor } from './CashbackRulesEditor'
import type { CashbackRule } from '@/types/cashback'
import type { CreditCard } from '@/types/creditCard'

const card: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265', cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  lastUpdated: '2026-01-01T00:00:00Z',
}
const food: CashbackRule = { id: 'r-food', cardId: 'card-1', mcc: '5812', ratePercent: 5, minCycleSpend: 3_000_000, capPerCycle: 200_000, tiers: [] }
const base: CashbackRule = { id: 'r-def', cardId: 'card-1', mcc: null, ratePercent: 0.5, minCycleSpend: 0, capPerCycle: null, tiers: [] }

function renderEditor() {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  render(<CashbackRulesEditor card={card} open onOpenChange={onOpenChange} />, { wrapper })
  return { onOpenChange }
}

const setField = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listCashbackRules).mockResolvedValue([])
})

describe('CashbackRulesEditor — danh sách', () => {
  it('thẻ chưa có rule: báo rõ và cho thêm', async () => {
    renderEditor()
    expect(await screen.findByText('Thẻ này chưa có rule hoàn tiền nào.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm rule' })).toBeEnabled()
  })

  it('đang tải: chưa cho thêm rule (chưa biết nhóm nào đã có)', () => {
    vi.mocked(listCashbackRules).mockReturnValue(new Promise(() => {}))
    renderEditor()
    expect(screen.getByText('Đang tải rule…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm rule' })).toBeDisabled()
  })

  it('tải lỗi: báo lỗi, không hiện "chưa có rule" (sẽ mời thêm trùng)', async () => {
    vi.mocked(listCashbackRules).mockRejectedValue({ code: 'X', message: 'lỗi' })
    renderEditor()
    expect(await screen.findByText(/Không tải được rule/)).toBeInTheDocument()
    expect(screen.queryByText('Thẻ này chưa có rule hoàn tiền nào.')).not.toBeInTheDocument()
  })

  it('liệt kê rule với mô tả % / ngưỡng / trần', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([food, base])
    renderEditor()
    expect(await screen.findByText('5812 · Nhà hàng')).toBeInTheDocument()
    expect(screen.getByText(/Hoàn 5% · chi tối thiểu .*3\.000\.000.*\/kỳ · trần .*200\.000.*\/kỳ/)).toBeInTheDocument()
    expect(screen.getByText('Mọi giao dịch còn lại (mặc định)')).toBeInTheDocument()
    expect(screen.getByText('Hoàn 0.5%')).toBeInTheDocument() // không ngưỡng, không trần
  })
})

describe('CashbackRulesEditor — thêm rule', () => {
  it('gửi giá trị đã chuẩn hoá cho đúng thẻ rồi quay về danh sách', async () => {
    const u = userEvent.setup()
    vi.mocked(createCashbackRule).mockResolvedValue(food)
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))

    setField('Áp dụng cho', '5812')
    setField('Hoàn (%)', '5,5')
    setField(/Chi tối thiểu/, '3.000.000')
    setField(/Trần hoàn/, '200.000')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))

    await waitFor(() => expect(createCashbackRule).toHaveBeenCalledWith('card-1', {
      mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000,
    }))
    expect(await screen.findByText('Thẻ này chưa có rule hoàn tiền nào.')).toBeInTheDocument()
  })

  it('rule mặc định: để nguyên "Mọi giao dịch còn lại" gửi mcc null, ngưỡng 0, không trần', async () => {
    const u = userEvent.setup()
    vi.mocked(createCashbackRule).mockResolvedValue(base)
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    setField('Hoàn (%)', '0,5')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))

    await waitFor(() => expect(createCashbackRule).toHaveBeenCalledWith('card-1', {
      mcc: null, ratePercent: 0.5, minCycleSpend: 0, capPerCycle: null,
    }))
  })

  it('dữ liệu sai bị chặn ở form, không gọi service', async () => {
    const u = userEvent.setup()
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    setField('Hoàn (%)', '150')
    setField(/Trần hoàn/, '0')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))

    expect(await screen.findByText('Tỷ lệ từ 0 đến 100')).toBeInTheDocument()
    expect(screen.getByText(/lớn hơn 0/)).toBeInTheDocument()
    expect(screen.getByLabelText('Hoàn (%)')).toHaveAttribute('aria-invalid', 'true')
    expect(createCashbackRule).not.toHaveBeenCalled()
  })

  it('nhóm đã có rule bị khoá trong dropdown, kể cả rule mặc định', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([food, base])
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    const select = screen.getByLabelText('Áp dụng cho') as HTMLSelectElement
    const opt = (text: RegExp) => within(select).getByRole('option', { name: text }) as HTMLOptionElement

    expect(opt(/5812/).disabled).toBe(true)
    expect(opt(/Mọi giao dịch còn lại/).disabled).toBe(true)
    expect(opt(/5411/).disabled).toBe(false)
  })

  // Mục '' (rule mặc định) bị khoá nhưng vẫn là giá trị ban đầu của <select>: user bấm Thêm mà không
  // chọn gì thì nhận lỗi trùng không nói rõ phải đổi gì.
  it('rule mặc định đã có: form mới chọn sẵn nhóm đầu tiên còn trống, không phải mục bị khoá', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([base])
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    expect(screen.getByLabelText('Áp dụng cho')).toHaveValue('5411') // 5411 là mã đầu tiên trong danh sách
  })

  it('nhóm đầu tiên cũng đã có rule: chọn sẵn nhóm trống kế tiếp', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([base, { ...food, id: 'r-5411', mcc: '5411' }])
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    expect(screen.getByLabelText('Áp dụng cho')).toHaveValue('5812')
  })

  it('chưa có rule nào: chọn sẵn rule mặc định như trước', async () => {
    const u = userEvent.setup()
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    expect(screen.getByLabelText('Áp dụng cho')).toHaveValue('')
  })

  it('gợi ý của ô được nối aria-describedby, và nhường chỗ cho lỗi khi có', async () => {
    const u = userEvent.setup()
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    const min = screen.getByLabelText(/Chi tối thiểu/)
    expect(min).toHaveAttribute('aria-describedby', 'rule-min-hint')
    expect(document.getElementById('rule-min-hint')).toHaveTextContent('Để trống nếu không yêu cầu')

    setField(/Chi tối thiểu/, '1.5')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))
    await waitFor(() => expect(min).toHaveAttribute('aria-describedby', 'rule-min-error'))
    expect(document.getElementById('rule-min-hint')).toBeNull()
  })

  it('trùng nhóm (server từ chối) hiện thông điệp và giữ form để sửa', async () => {
    const u = userEvent.setup()
    vi.mocked(createCashbackRule).mockRejectedValue({ code: '23505', message: 'Thẻ này đã có rule cho nhóm đó.' })
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    setField('Hoàn (%)', '5')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))

    expect(await screen.findByText('Thẻ này đã có rule cho nhóm đó.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hoàn (%)')).toHaveValue('5')
  })

  it('đang lưu thì Esc không đóng dialog; lưu xong mới quay lại danh sách', async () => {
    const u = userEvent.setup()
    let resolve!: (r: CashbackRule) => void
    vi.mocked(createCashbackRule).mockReturnValue(new Promise((r) => { resolve = r }))
    const { onOpenChange } = renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Thêm rule' }))
    setField('Hoàn (%)', '5')
    await u.click(screen.getByRole('button', { name: 'Thêm rule' }))
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toBeDisabled()

    await u.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()

    resolve(food)
    expect(await screen.findByText('Thẻ này chưa có rule hoàn tiền nào.')).toBeInTheDocument()
  })
})

describe('CashbackRulesEditor — sửa và xoá', () => {
  it('sửa: điền sẵn giá trị, được giữ nhóm của chính rule, gọi update đúng id', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([food, base])
    vi.mocked(updateCashbackRule).mockResolvedValue(food)
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Sửa rule 5812 · Nhà hàng' }))

    expect(screen.getByLabelText('Áp dụng cho')).toHaveValue('5812')
    expect((within(screen.getByLabelText('Áp dụng cho')).getByRole('option', { name: /5812/ }) as HTMLOptionElement).disabled).toBe(false)
    expect(screen.getByLabelText('Hoàn (%)')).toHaveValue('5')
    expect(screen.getByLabelText(/Chi tối thiểu/)).toHaveValue('3000000')

    setField('Hoàn (%)', '6')
    await u.click(screen.getByRole('button', { name: 'Lưu rule' }))
    await waitFor(() => expect(updateCashbackRule).toHaveBeenCalledWith('r-food', {
      mcc: '5812', ratePercent: 6, minCycleSpend: 3_000_000, capPerCycle: 200_000,
    }))
    expect(createCashbackRule).not.toHaveBeenCalled()
  })

  it('xoá cần hai bước: bấm Xoá chỉ hiện nút xác nhận, chưa xoá', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([food])
    vi.mocked(deleteCashbackRule).mockResolvedValue()
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Xoá rule 5812 · Nhà hàng' }))
    expect(deleteCashbackRule).not.toHaveBeenCalled()

    await u.click(screen.getByRole('button', { name: 'Xác nhận xoá rule 5812 · Nhà hàng' }))
    await waitFor(() => expect(deleteCashbackRule).toHaveBeenCalledWith('r-food'))
  })

  it('xoá lỗi: báo lỗi ngay trong dòng và quay lại nút Xoá', async () => {
    const u = userEvent.setup()
    vi.mocked(listCashbackRules).mockResolvedValue([food])
    vi.mocked(deleteCashbackRule).mockRejectedValue({ code: 'NOT_FOUND', message: 'Không tìm thấy rule.' })
    renderEditor()
    await u.click(await screen.findByRole('button', { name: 'Xoá rule 5812 · Nhà hàng' }))
    await u.click(screen.getByRole('button', { name: 'Xác nhận xoá rule 5812 · Nhà hàng' }))

    expect(await screen.findByText('Không tìm thấy rule.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xoá rule 5812 · Nhà hàng' })).toBeInTheDocument()
  })
})
