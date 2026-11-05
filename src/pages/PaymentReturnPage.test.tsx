import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/services/payments', () => ({ getOrder: vi.fn(), refreshOrder: vi.fn() }))

import { getOrder, refreshOrder } from '@/services/payments'
import type { PaymentOrder } from '@/types/payment'
import { PaymentReturnPage } from './PaymentReturnPage'

const ID = '00000000-0000-4000-8000-000000000001'
const order = (status: PaymentOrder['status']): PaymentOrder => ({
  id: ID, provider: 'momo', status, amountVnd: 50000, credits: 500, createdAt: '2026-10-31T03:00:00.000Z',
})

// Mount THẬT (hook thật + QueryClient thật): vòng lặp render từng lọt qua test vì không test nào mount hook.
function renderAt(search: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[`/payment/return${search}`]}><PaymentReturnPage /></MemoryRouter></QueryClientProvider>,
  ) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(refreshOrder).mockResolvedValue('pending')
})

describe('PaymentReturnPage', () => {
  it('đã nhận: hiện credit đã cộng + invalidate số dư / giao dịch', async () => {
    vi.mocked(getOrder).mockResolvedValue(order('paid'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    renderAt(`?order=${ID}`, client)
    expect(await screen.findByText('Đã nhận thanh toán')).toBeInTheDocument()
    expect(screen.getByText(/Đã cộng/)).toHaveTextContent('500')
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toEqual(expect.arrayContaining(['["credits"]', '["unparsedMessages"]', '["transactions"]', '["creditCardTransactions"]', '["dashboardStats"]']))
  })

  it('đang chờ: báo chờ, nhờ server đối soát ngay lần đầu', async () => {
    vi.mocked(getOrder).mockResolvedValue(order('pending'))
    renderAt(`?order=${ID}`)
    expect(await screen.findByText('Đang chờ xác nhận thanh toán')).toBeInTheDocument()
    expect(refreshOrder).toHaveBeenCalledWith(ID)
  })

  it('refresh báo đã paid -> đọc lại đơn và hiện đã nhận', async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order('pending')).mockResolvedValue(order('paid'))
    vi.mocked(refreshOrder).mockResolvedValue('paid')
    renderAt(`?order=${ID}`)
    expect(await screen.findByText('Đã nhận thanh toán')).toBeInTheDocument()
  })

  it('thất bại / hết hạn / cần hỗ trợ: mỗi trạng thái một thông điệp, không cộng credit', async () => {
    for (const [status, text] of [['failed', 'Thanh toán thất bại'], ['expired', 'Đơn đã hết hạn'], ['mismatch', 'Cần hỗ trợ']] as const) {
      vi.mocked(getOrder).mockResolvedValue(order(status))
      const { unmount } = renderAt(`?order=${ID}`)
      expect(await screen.findByText(text)).toBeInTheDocument()
      expect(refreshOrder).not.toHaveBeenCalled()
      unmount()
    }
  })

  it('mismatch hiện mã đơn để liên hệ hỗ trợ', async () => {
    vi.mocked(getOrder).mockResolvedValue(order('mismatch'))
    renderAt(`?order=${ID}`)
    expect(await screen.findByText(ID)).toBeInTheDocument()
  })

  it('thiếu / sai mã đơn -> liên kết không hợp lệ, KHÔNG gọi DB; đơn không thấy -> báo', async () => {
    renderAt('?order=../../x')
    expect(await screen.findByText('Liên kết không hợp lệ')).toBeInTheDocument()
    expect(getOrder).not.toHaveBeenCalled()
  })

  it('đơn không thấy (của người khác / không tồn tại)', async () => {
    vi.mocked(getOrder).mockResolvedValue(null)
    renderAt(`?order=${ID}`)
    expect(await screen.findByText('Không tìm thấy đơn')).toBeInTheDocument()
  })
})
