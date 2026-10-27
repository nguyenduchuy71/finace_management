import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/api-keys', () => ({
  listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { listApiKeys, revokeApiKey } from '@/services/api-keys'
import { toast } from 'sonner'
import type { ApiKey } from '@/types/api-key'
import { ApiKeysSection } from './ApiKeysSection'

const key = (over: Partial<ApiKey> & { id: string; name: string }): ApiKey => ({
  prefix: 'vj_abc123',
  last4: 'Wxyz',
  createdAt: '2026-10-01T10:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  ...over,
})

const tenActive = () => Array.from({ length: 10 }, (_, i) => key({ id: `k${i}`, name: `Key ${i}` }))

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<ApiKeysSection />, { wrapper })
}

/** Dòng <li> của key có tên `name`. */
async function rowOf(name: string) {
  const li = (await screen.findByText(name)).closest('li')
  if (!li) throw new Error(`không thấy dòng key ${name}`)
  return li
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listApiKeys).mockResolvedValue([])
})

describe('ApiKeysSection — danh sách', () => {
  it('key đang dùng có nút Thu hồi; key đã thu hồi có badge và KHÔNG có nút Thu hồi', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([
      key({ id: 'k1', name: 'iPhone' }),
      key({ id: 'k2', name: 'iPad cũ', revokedAt: '2026-10-02T00:00:00.000Z' }),
    ])
    renderSection()

    const active = await rowOf('iPhone')
    expect(within(active).getByRole('button', { name: 'Thu hồi' })).toBeInTheDocument()
    expect(within(active).queryByText('Đã thu hồi')).toBeNull()

    const revoked = await rowOf('iPad cũ')
    expect(within(revoked).getByText('Đã thu hồi')).toBeInTheDocument()
    expect(within(revoked).queryByRole('button', { name: 'Thu hồi' })).toBeNull()
  })

  it('hiện prefix…last4 và "Chưa dùng" khi chưa có lần dùng', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([key({ id: 'k1', name: 'iPhone' })])
    renderSection()
    const row = await rowOf('iPhone')
    expect(within(row).getByText('vj_abc123…Wxyz')).toBeInTheDocument()
    expect(within(row).getByText(/Chưa dùng/)).toBeInTheDocument()
  })

  it('danh sách rỗng -> gợi ý tạo key', async () => {
    renderSection()
    expect(await screen.findByText(/Chưa có key nào/)).toBeInTheDocument()
  })

  it('lỗi tải -> hiện message lỗi và nút thử lại', async () => {
    vi.mocked(listApiKeys).mockRejectedValue({ code: 'XX', message: 'Mất kết nối' })
    renderSection()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Mất kết nối')
    expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})

describe('ApiKeysSection — giới hạn 10 key', () => {
  it('đủ 10 key còn hiệu lực -> nút Tạo key disabled và có thông báo', async () => {
    vi.mocked(listApiKeys).mockResolvedValue(tenActive())
    renderSection()
    await screen.findByText('Key 0')
    expect(screen.getByRole('button', { name: /Tạo key/ })).toBeDisabled()
    expect(screen.getByText(/Đã đủ 10 key còn hiệu lực/)).toBeInTheDocument()
  })

  it('key đã thu hồi KHÔNG tính vào trần: 9 đang dùng + 3 đã thu hồi -> vẫn tạo được', async () => {
    const revoked = [1, 2, 3].map((i) => key({ id: `r${i}`, name: `Cũ ${i}`, revokedAt: '2026-10-02T00:00:00.000Z' }))
    vi.mocked(listApiKeys).mockResolvedValue([...tenActive().slice(0, 9), ...revoked])
    renderSection()
    await screen.findByText('Cũ 1')
    expect(screen.getByRole('button', { name: /Tạo key/ })).toBeEnabled()
    expect(screen.queryByText(/Đã đủ 10 key/)).toBeNull()
  })
})

describe('ApiKeysSection — thu hồi', () => {
  it('xác nhận thu hồi -> gọi revokeApiKey(id) và báo thành công', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([key({ id: 'k1', name: 'iPhone' })])
    vi.mocked(revokeApiKey).mockResolvedValue(undefined)
    renderSection()

    fireEvent.click(within(await rowOf('iPhone')).getByRole('button', { name: 'Thu hồi' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Thu hồi key “iPhone”/)).toBeInTheDocument()
    expect(within(dialog).getByText(/không bật lại được/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Thu hồi' }))
    await waitFor(() => expect(revokeApiKey).toHaveBeenCalledWith('k1'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã thu hồi key'))
  })

  it('Huỷ trong hộp xác nhận -> KHÔNG gọi revokeApiKey', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([key({ id: 'k1', name: 'iPhone' })])
    renderSection()

    fireEvent.click(within(await rowOf('iPhone')).getByRole('button', { name: 'Thu hồi' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(revokeApiKey).not.toHaveBeenCalled()
  })

  it('thu hồi lỗi -> toast hiện đúng message của ApiError', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([key({ id: 'k1', name: 'iPhone' })])
    vi.mocked(revokeApiKey).mockRejectedValue({ code: 'P0002', message: 'Không tìm thấy key' })
    renderSection()

    fireEvent.click(within(await rowOf('iPhone')).getByRole('button', { name: 'Thu hồi' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Thu hồi' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không tìm thấy key'))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
