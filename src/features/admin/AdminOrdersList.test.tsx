import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/admin', () => ({
  listAdminOrders: vi.fn(),
  resolveAdminOrder: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { listAdminOrders, resolveAdminOrder } from '@/services/admin'
import { toast } from 'sonner'
import { adminOrder, ordersResult } from '@/test/fixtures/admin'
import { AdminOrdersList } from './AdminOrdersList'

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return render(<AdminOrdersList />, { wrapper })
}

const orders = [
  adminOrder({ id: 'm1', status: 'mismatch' }),
  adminOrder({ id: 'p1', status: 'paid', paidAt: '2026-10-30T01:05:00Z', providerTxId: 'TX9' }),
  adminOrder({ id: 'f1', status: 'failed', provider: 'zalopay' }),
  adminOrder({ id: 'w1', status: 'pending' }),
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAdminOrders).mockResolvedValue(ordersResult(orders))
  vi.mocked(resolveAdminOrder).mockResolvedValue({ status: 'paid', credits: 500, balance: 600 })
})

describe('AdminOrdersList', () => {
  it('liệt kê đơn kèm trạng thái, tổng và mã giao dịch; chưa lọc -> gọi với null/null', async () => {
    renderList()
    expect(await screen.findByText('(4)')).toBeInTheDocument()
    expect(listAdminOrders).toHaveBeenCalledWith({ status: null, provider: null })
    expect(screen.getAllByText('Lệch tiền / quá hạn')).toHaveLength(2) // option lọc + badge của đơn m1
    expect(screen.getByText(/GD TX9/)).toBeInTheDocument()
  })

  it('đơn đã thanh toán KHÔNG có nút xử lý; đơn thất bại chỉ có "Đã thanh toán"; mismatch/pending có cả hai', async () => {
    renderList()
    await screen.findByText('(4)')
    expect(screen.queryByRole('button', { name: /đơn 261030_p1/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /đơn 261030_f1/ }).map((b) => b.textContent)).toEqual(['Đã thanh toán'])
    expect(screen.getAllByRole('button', { name: /đơn 261030_m1/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /đơn 261030_w1/ })).toHaveLength(2)
  })

  it('đổi bộ lọc -> truy vấn lại với bộ lọc mới (nằm trong queryKey)', async () => {
    renderList()
    await screen.findByText('(4)')
    fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), { target: { value: 'mismatch' } })
    await waitFor(() => expect(listAdminOrders).toHaveBeenLastCalledWith({ status: 'mismatch', provider: null }))
    fireEvent.change(screen.getByLabelText('Lọc theo cổng thanh toán'), { target: { value: 'zalopay' } })
    await waitFor(() => expect(listAdminOrders).toHaveBeenLastCalledWith({ status: 'mismatch', provider: 'zalopay' }))
  })

  it('danh sách rỗng và lỗi tải đều có thông báo; lỗi có nút Thử lại', async () => {
    vi.mocked(listAdminOrders).mockResolvedValueOnce(ordersResult([]))
    const { unmount } = renderList()
    expect(await screen.findByText('Không có đơn nào.')).toBeInTheDocument()
    unmount()
    vi.mocked(listAdminOrders).mockRejectedValueOnce({ code: 'x', message: 'Đã có lỗi xảy ra.' })
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã có lỗi xảy ra.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('(4)')).toBeInTheDocument()
  })

  it('đánh dấu đã thanh toán: lý do < 5 ký tự -> disabled; gửi lý do đã trim; toast kèm số credit', async () => {
    renderList()
    await screen.findByText('(4)')
    fireEvent.click(screen.getByRole('button', { name: /Đã thanh toán: đơn 261030_m1/ }))
    const confirm = screen.getByRole('button', { name: 'Đánh dấu đã thanh toán' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'abcd' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: '  đã đối chiếu sao kê  ' } })
    // Đơn m1 chưa có mã giao dịch của ví -> bắt buộc nhập mã (trống / toàn khoảng trắng / > 100 ký tự đều chặn).
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Mã giao dịch của ví'), { target: { value: '   ' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Mã giao dịch của ví'), { target: { value: '  TXNEW1 ' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(resolveAdminOrder).toHaveBeenCalledWith('m1', 'mark_paid', 'đã đối chiếu sao kê', 'TXNEW1'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã đánh dấu đã thanh toán (+500 credit)'))
    await waitFor(() => expect(screen.queryByLabelText(/Lý do/)).toBeNull())
    // Sau thao tác: tải lại danh sách đơn (2 lần gọi tổng cộng), không có thao tác nào khác.
    await waitFor(() => expect(listAdminOrders).toHaveBeenCalledTimes(2))
  })

  it('đơn đã có mã giao dịch: không hiện ô mã, không gửi providerTxId; mark_failed cũng không cần mã', async () => {
    vi.mocked(listAdminOrders).mockResolvedValue(ordersResult([adminOrder({ id: 'x1', status: 'mismatch', providerTxId: 'TX7' })]))
    renderList()
    await screen.findByText('(1)')
    fireEvent.click(screen.getByRole('button', { name: /Đã thanh toán: đơn 261030_x1/ }))
    expect(screen.queryByLabelText('Mã giao dịch của ví')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'đã đối chiếu sao kê' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã thanh toán' }))
    await waitFor(() => expect(resolveAdminOrder).toHaveBeenCalledWith('x1', 'mark_paid', 'đã đối chiếu sao kê', undefined))
  })

  it('mark_failed không đòi mã giao dịch', async () => {
    renderList()
    await screen.findByText('(4)')
    fireEvent.click(screen.getByRole('button', { name: /Thất bại: đơn 261030_m1/ }))
    expect(screen.queryByLabelText('Mã giao dịch của ví')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'khách huỷ giao dịch' } })
    expect(screen.getByRole('button', { name: 'Đánh dấu thất bại' })).toBeEnabled()
  })

  it('banner đối soát: ẩn khi khoẻ; hiện khi bị bỏ qua / quá cũ / có đơn kẹt / không đọc được', async () => {
    const recent = new Date().toISOString()
    const healthy = { lastOutcome: 'sent', lastAt: recent, lastHttpStatus: 200, stalePending: 0 }
    renderList()
    await screen.findByText('(4)')
    expect(screen.queryByText(/Đối soát thanh toán tự động cần kiểm tra/)).toBeNull()
    cleanup()

    const cases: [Parameters<typeof ordersResult>[1], RegExp][] = [
      [{ ...healthy, lastOutcome: 'skipped:no_secret' }, /bị bỏ qua \(no_secret\)/],
      [{ ...healthy, lastAt: new Date(Date.now() - 40 * 60_000).toISOString() }, /cách đây 4\d phút/],
      [{ ...healthy, stalePending: 3 }, /3 đơn đang chờ quá 15 phút/],
      [{ ...healthy, lastHttpStatus: 401 }, /trả mã 401/],
      [null, /Không đọc được trạng thái đối soát/],
    ]
    for (const [recon, text] of cases) {
      vi.mocked(listAdminOrders).mockResolvedValue(ordersResult(orders, recon))
      renderList()
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      cleanup()
    }
  })

  it('đánh dấu thất bại gửi mark_failed; lỗi order_not_resolvable hiện trong dialog và dialog KHÔNG đóng', async () => {
    vi.mocked(resolveAdminOrder).mockRejectedValue({ code: 'order_not_resolvable', message: 'Đơn đã được xử lý.' })
    renderList()
    await screen.findByText('(4)')
    fireEvent.click(screen.getByRole('button', { name: /Thất bại: đơn 261030_w1/ }))
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'khách huỷ giao dịch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu thất bại' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Đơn đã được xử lý.')
    expect(resolveAdminOrder).toHaveBeenCalledWith('w1', 'mark_failed', 'khách huỷ giao dịch', undefined)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('Huỷ không gọi resolve', async () => {
    renderList()
    await screen.findByText('(4)')
    fireEvent.click(screen.getByRole('button', { name: /Thất bại: đơn 261030_m1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(resolveAdminOrder).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByLabelText(/Lý do/)).toBeNull())
  })
})
