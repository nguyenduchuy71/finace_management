import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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

import { listCashbackRules, getCycleExpenses } from '@/services/cashbackRules'
import { CashbackSummary } from './CashbackSummary'
import { BillingCycleInfoCard } from './BillingCycleInfoCard'
import type { CashbackRule } from '@/types/cashback'
import type { CreditCard, CreditCardTransaction } from '@/types/creditCard'

const card: CreditCard = {
  id: 'card-1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265', cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0, statementDate: 9, paymentDueDate: 29,
  cashbackMonthlyCap: null,
  lastUpdated: '2026-01-01T00:00:00Z',
}
const cycle = { startISO: '2026-03-09T17:00:00.000Z', endISO: '2026-04-09T17:00:00.000Z' }

const rule = (over: Partial<CashbackRule>): CashbackRule => ({
  id: 'r1', cardId: 'card-1', mcc: null, ratePercent: 1, minCycleSpend: 0, capPerCycle: null, tiers: [], ...over,
})
const tx = (amount: number, mcc?: string): CreditCardTransaction => ({
  id: `t${Math.random()}`, cardId: 'card-1', amount, description: 'x', merchantName: 'x',
  type: amount > 0 ? 'payment' : 'purchase', status: 'posted',
  transactionDate: '2026-03-20T10:00:00Z', mcc,
})

function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return { client, ...render(ui, { wrapper }) }
}
const renderSummary = () => renderUi(<CashbackSummary card={card} cycle={cycle} />)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listCashbackRules).mockResolvedValue([])
  vi.mocked(getCycleExpenses).mockResolvedValue([])
})

describe('CashbackSummary', () => {
  it('lấy chi tiêu đúng thẻ và đúng khoảng chu kỳ', async () => {
    renderSummary()
    await waitFor(() => expect(getCycleExpenses).toHaveBeenCalledWith('card-1', cycle.startISO, cycle.endISO))
    expect(listCashbackRules).toHaveBeenCalledWith('card-1')
  })

  it('đang tải: báo đang tính', () => {
    vi.mocked(listCashbackRules).mockReturnValue(new Promise(() => {}))
    renderSummary()
    expect(screen.getByText('Đang tính…')).toBeInTheDocument()
  })

  it('chưa có rule: gợi ý cài đặt, không hiện số tiền 0 gây hiểu nhầm', async () => {
    renderSummary()
    expect(await screen.findByText(/Chưa có rule hoàn tiền/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cài đặt hoàn tiền' })).toBeInTheDocument()
    expect(screen.queryByText('ước tính')).not.toBeInTheDocument()
  })

  it('hiển thị tổng hoàn ước tính và từng rule có phát sinh chi', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([
      rule({ id: 'a', mcc: '5812', ratePercent: 5 }),
      rule({ id: 'b', mcc: '5411', ratePercent: 2 }), // không có chi -> không liệt kê
      rule({ id: 'c', mcc: null, ratePercent: 1 }),
    ])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-200_000, '5812'), tx(-1_000_000)])
    renderSummary()

    expect(await screen.findByText('ước tính')).toBeInTheDocument()
    // 5% × 200k = 10k  +  1% × 1tr = 10k  => 20k
    expect(screen.getByTestId('cashback-total')).toHaveTextContent(/^đ 20\.000/)
    expect(screen.getByText('5812 · Nhà hàng')).toBeInTheDocument()
    expect(screen.getByText('Mọi giao dịch còn lại (mặc định)')).toBeInTheDocument()
    expect(screen.queryByText('5411 · Siêu thị')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rule hoàn tiền' })).toBeInTheDocument()
  })

  it('đánh dấu rule chưa đạt ngưỡng và rule đã chạm trần', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([
      rule({ id: 'a', mcc: '5812', ratePercent: 5, minCycleSpend: 3_000_000 }),
      rule({ id: 'b', mcc: '5411', ratePercent: 10, capPerCycle: 50_000 }),
    ])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-1_000_000, '5812'), tx(-5_000_000, '5411')])
    renderSummary()

    expect(await screen.findByText(/Chưa đạt ngưỡng/)).toBeInTheDocument()
    expect(screen.getByText('Đã chạm trần')).toBeInTheDocument()
    // rule 5812 chưa đạt ngưỡng nên 0; chỉ rule 5411 hoàn và bị cắt ở trần 50.000
    expect(screen.getByTestId('cashback-total')).toHaveTextContent(/^đ 50\.000/)
  })

  it('bỏ qua giao dịch dương (hoàn trả) khi tính', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ ratePercent: 10 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-100_000), tx(500_000)])
    renderSummary()
    expect(await screen.findByTestId('cashback-total')).toHaveTextContent(/^đ 10\.000/)
  })

  it('có rule nhưng chưa có giao dịch chi: nói rõ thay vì liệt kê rule rỗng', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ mcc: '5812', ratePercent: 5 })])
    renderSummary()
    expect(await screen.findByText(/Chưa có giao dịch chi nào thuộc rule/)).toBeInTheDocument()
  })

  it('chi tiêu không thuộc rule nào (không có rule mặc định) được báo riêng', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ mcc: '5812', ratePercent: 5 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-100_000, '5812'), tx(-250_000, '5411')])
    renderSummary()
    expect(await screen.findByText(/250\.000.* không thuộc rule nào/)).toBeInTheDocument()
  })

  it('lỗi tải: báo lỗi và thử lại gọi lại cả hai nguồn dữ liệu', async () => {
    const u = userEvent.setup()
    vi.mocked(getCycleExpenses).mockRejectedValue({ code: 'X', message: 'lỗi' })
    renderSummary()
    expect(await screen.findByText(/Không tính được hoàn tiền/)).toBeInTheDocument()
    expect(screen.queryByText('ước tính')).not.toBeInTheDocument()

    vi.mocked(getCycleExpenses).mockResolvedValue([])
    vi.mocked(listCashbackRules).mockClear()
    await u.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(listCashbackRules).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Không tính được hoàn tiền/)).not.toBeInTheDocument())
  })

  // Tải xong một lần rồi một lần refetch lỗi: `result` vẫn còn từ cache nhưng đã cũ.
  it('lỗi SAU khi đã có số: ẩn tổng cũ thay vì hiện cạnh dòng báo lỗi', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ ratePercent: 1 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-1_000_000)])
    const { client } = renderSummary()
    expect(await screen.findByTestId('cashback-total')).toHaveTextContent(/^đ 10\.000/)

    vi.mocked(getCycleExpenses).mockRejectedValue({ code: 'X', message: 'lỗi' })
    await act(() => client.invalidateQueries({ queryKey: ['cardCycleExpenses'] }))

    expect(await screen.findByText(/Không tính được hoàn tiền/)).toBeInTheDocument()
    expect(screen.queryByTestId('cashback-total')).not.toBeInTheDocument()
    expect(screen.queryByText('ước tính')).not.toBeInTheDocument()
  })

  it('nút mở hộp thoại quản lý rule', async () => {
    const u = userEvent.setup()
    renderSummary()
    await u.click(await screen.findByRole('button', { name: 'Cài đặt hoàn tiền' }))
    expect(await screen.findByText('Rule hoàn tiền — SHB Visa')).toBeInTheDocument()
  })
})

// Test render THẬT cả thẻ chu kỳ với hook thật: repo từng có render loop lọt qua hàng trăm test xanh
// vì không test nào mount component dùng hook đó.
describe('BillingCycleInfoCard + hoàn tiền', () => {
  it('mount ổn định, không vòng lặp render, gọi dữ liệu đúng một lần', async () => {
    vi.mocked(listCashbackRules).mockResolvedValue([rule({ ratePercent: 1 })])
    vi.mocked(getCycleExpenses).mockResolvedValue([tx(-1_000_000)])
    renderUi(<BillingCycleInfoCard card={card} />)

    expect(await screen.findByTestId('cashback-total')).toHaveTextContent(/^đ 10\.000/)
    expect(screen.getByText('Chu kỳ sao kê hiện tại')).toBeInTheDocument()
    expect(listCashbackRules).toHaveBeenCalledTimes(1)
    expect(getCycleExpenses).toHaveBeenCalledTimes(1)
  })

  // Trước đây `now` chốt một lần lúc mount: tab mở qua mốc cắt sao kê vẫn hiện chu kỳ và hoàn tiền của kỳ cũ.
  it('tab mở qua mốc cắt sao kê: sang chu kỳ mới và tải lại chi tiêu của kỳ mới', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      // Thẻ sao kê ngày 9: chu kỳ kết thúc 00:00 VN ngày 10/04 = 2026-04-09T17:00:00Z
      vi.setSystemTime(new Date('2026-04-09T16:30:00Z'))
      vi.mocked(listCashbackRules).mockResolvedValue([rule({ ratePercent: 1 })])
      vi.mocked(getCycleExpenses).mockResolvedValue([])
      renderUi(<BillingCycleInfoCard card={card} />)

      await waitFor(() => expect(getCycleExpenses).toHaveBeenCalledWith(
        'card-1', '2026-03-09T17:00:00.000Z', '2026-04-09T17:00:00.000Z'))
      expect(getCycleExpenses).toHaveBeenCalledTimes(1)

      await act(async () => { vi.setSystemTime(new Date('2026-04-09T17:05:00Z')); await vi.advanceTimersByTimeAsync(60_000) })

      await waitFor(() => expect(getCycleExpenses).toHaveBeenCalledWith(
        'card-1', '2026-04-09T17:00:00.000Z', '2026-05-09T17:00:00.000Z'))
      expect(screen.getByText('10/04/2026')).toBeInTheDocument() // ngày bắt đầu của chu kỳ mới
    } finally {
      vi.useRealTimers()
    }
  })

  it('giữa chu kỳ: đồng hồ chạy nhưng KHÔNG tải lại chi tiêu (khoá truy vấn theo ranh giới chu kỳ, không theo "bây giờ")', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.setSystemTime(new Date('2026-03-20T05:00:00Z'))
      vi.mocked(listCashbackRules).mockResolvedValue([rule({ ratePercent: 1 })])
      vi.mocked(getCycleExpenses).mockResolvedValue([])
      renderUi(<BillingCycleInfoCard card={card} />)
      await waitFor(() => expect(getCycleExpenses).toHaveBeenCalledTimes(1))

      await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000) })
      expect(getCycleExpenses).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
