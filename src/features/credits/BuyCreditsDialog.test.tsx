import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/payments', () => ({
  listPackages: vi.fn(), getProviders: vi.fn(), createPayment: vi.fn(), listOrders: vi.fn(), getOrder: vi.fn(), refreshOrder: vi.fn(),
}))

import { createPayment, getProviders, listPackages } from '@/services/payments'
import { BuyCreditsDialog } from './BuyCreditsDialog'

const PACKAGES = [
  { id: 'p50k', credits: 500, priceVnd: 50000 },
  { id: 'p100k', credits: 1200, priceVnd: 100000 },
]

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><BuyCreditsDialog /></QueryClientProvider>)
}

const assign = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listPackages).mockResolvedValue(PACKAGES)
  vi.stubGlobal('location', { ...window.location, assign })
})
afterEach(() => vi.unstubAllGlobals())

describe('BuyCreditsDialog', () => {
  it('chỉ hiện ví đang bật; gói đọc từ DB (giá + credit)', async () => {
    vi.mocked(getProviders).mockResolvedValue(['momo'])
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Nạp credit' }))
    expect(await screen.findByRole('radio', { name: /MoMo/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /ZaloPay/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /1\.200 credit/ })).toBeInTheDocument()
  })

  it('không ví nào bật -> báo, nút Thanh toán khoá', async () => {
    vi.mocked(getProviders).mockResolvedValue([])
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Nạp credit' }))
    expect(await screen.findByText(/Chưa có ví nào được mở/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thanh toán' })).toBeDisabled()
  })

  it('chọn gói + ví -> tạo đơn rồi chuyển trang tới pay_url', async () => {
    vi.mocked(getProviders).mockResolvedValue(['momo', 'zalopay'])
    vi.mocked(createPayment).mockResolvedValue({ orderId: 'o1', payUrl: 'https://test-payment.momo.vn/pay/1' })
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Nạp credit' }))
    await userEvent.click(await screen.findByRole('radio', { name: /1\.200 credit/ }))
    await userEvent.click(screen.getByRole('radio', { name: /ZaloPay/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://test-payment.momo.vn/pay/1'))
    expect(createPayment).toHaveBeenCalledWith('zalopay', 'p100k')
  })

  it('tạo đơn lỗi -> hiện thông điệp, KHÔNG chuyển trang', async () => {
    vi.mocked(getProviders).mockResolvedValue(['momo'])
    vi.mocked(createPayment).mockRejectedValue({ code: 'too_many_pending', message: 'Bạn đang có quá nhiều đơn chờ thanh toán.' })
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Nạp credit' }))
    await userEvent.click(await screen.findByRole('radio', { name: /500 credit/ }))
    await userEvent.click(screen.getByRole('radio', { name: /MoMo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Thanh toán' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('quá nhiều đơn')
    expect(assign).not.toHaveBeenCalled()
  })
})
