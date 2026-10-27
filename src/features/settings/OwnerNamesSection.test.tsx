import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Giữ normalizeOwnerNames THẬT (component dùng nó để so "đã đổi chưa"); chỉ mock I/O.
vi.mock('@/services/user-settings', async (orig) => ({
  ...(await orig<typeof import('@/services/user-settings')>()),
  getUserSettings: vi.fn(),
  updateOwnerNames: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getUserSettings, updateOwnerNames } from '@/services/user-settings'
import { toast } from 'sonner'
import { OwnerNamesSection } from './OwnerNamesSection'

const LABEL = 'Tên chủ tài khoản (mỗi dòng một tên)'

function settingsWith(ownerNames: string[]) {
  return { ownerNames, privacyConsentAt: null, privacyPolicyVersion: '2026-10' }
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<OwnerNamesSection />, { wrapper })
}

const textarea = () => screen.findByLabelText(LABEL) as Promise<HTMLTextAreaElement>
const saveButton = () => screen.getByRole('button', { name: 'Lưu' })
const type = (value: string) => fireEvent.change(screen.getByLabelText(LABEL), { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUserSettings).mockResolvedValue(settingsWith(['NGUYEN VAN A']))
  vi.mocked(updateOwnerNames).mockReset()
})

describe('OwnerNamesSection', () => {
  it('hiện tên đã lưu, một tên một dòng; nút Lưu disabled khi chưa đổi gì', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(settingsWith(['NGUYEN VAN A', 'TRAN B']))
    renderSection()
    expect(await textarea()).toHaveValue('NGUYEN VAN A\nTRAN B')
    expect(saveButton()).toBeDisabled()
  })

  it('chỉ đổi khoảng trắng/xuống dòng thừa (sau chuẩn hoá vẫn y hệt) -> Lưu vẫn disabled', async () => {
    renderSection()
    await textarea()
    type('  NGUYEN   VAN A  \n\n')
    expect(saveButton()).toBeDisabled()
  })

  it('chuẩn hoá trước khi gửi: trim, gộp khoảng trắng, bỏ trùng không phân biệt hoa thường, bỏ dòng rỗng', async () => {
    vi.mocked(updateOwnerNames).mockResolvedValue(['NGUYEN VAN A', 'TRAN B'])
    renderSection()
    await textarea()

    type('  NGUYEN   VAN A \nnguyen van a\nTRAN B\n\n   TRAN   B  ')
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    await waitFor(() => expect(updateOwnerNames).toHaveBeenCalledWith(['NGUYEN VAN A', 'TRAN B']))
    expect(updateOwnerNames).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã lưu tên chủ tài khoản'))
  })

  it('xoá hết tên -> lưu mảng rỗng', async () => {
    vi.mocked(updateOwnerNames).mockResolvedValue([])
    renderSection()
    await textarea()
    type('   \n  ')
    fireEvent.click(saveButton())
    await waitFor(() => expect(updateOwnerNames).toHaveBeenCalledWith([]))
  })

  it('quá 10 tên -> báo lỗi tại chỗ, KHÔNG gọi service', async () => {
    renderSection()
    await textarea()
    type(Array.from({ length: 11 }, (_, i) => `NGUYEN VAN ${i}`).join('\n'))
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Tối đa 10 tên.')
    expect(updateOwnerNames).not.toHaveBeenCalled()
  })

  it.each([
    ['ngắn hơn 3 ký tự', 'AB'],
    ['dài hơn 100 ký tự', 'A'.repeat(101)],
  ])('tên %s -> báo lỗi tại chỗ, KHÔNG gọi service (khớp CHECK ở DB)', async (_label, name) => {
    renderSection()
    await textarea()
    type(`NGUYEN VAN A\n${name}`)
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Mỗi tên 3–100 ký tự')
    expect(updateOwnerNames).not.toHaveBeenCalled()
  })

  it('đúng 10 tên là hợp lệ (biên trên)', async () => {
    vi.mocked(updateOwnerNames).mockResolvedValue([])
    renderSection()
    await textarea()
    type(Array.from({ length: 10 }, (_, i) => `NAME ${i}`).join('\n'))
    fireEvent.click(saveButton())
    await waitFor(() => expect(updateOwnerNames).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateOwnerNames).mock.calls[0][0]).toHaveLength(10)
  })

  it('service lỗi -> hiện message lỗi (ApiError), không toast thành công', async () => {
    vi.mocked(updateOwnerNames).mockRejectedValue({ code: '23514', message: 'Tối đa 10 tên chủ tài khoản.' })
    renderSection()
    await textarea()
    type('TRAN B')
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Tối đa 10 tên chủ tài khoản.')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('đang lưu -> nút "Đang lưu…" disabled', async () => {
    let finish: (v: string[]) => void = () => {}
    vi.mocked(updateOwnerNames).mockReturnValue(new Promise<string[]>((r) => { finish = r }))
    renderSection()
    await textarea()
    type('TRAN B')
    fireEvent.click(saveButton())
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toBeDisabled()
    finish(['NGUYEN VAN A', 'TRAN B'])
  })

  it('chưa có tên nào: nhập tên mới -> Lưu bật', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(settingsWith([]))
    renderSection()
    const ta = await textarea()
    expect(ta).toHaveValue('')
    expect(saveButton()).toBeDisabled()
    type('TRAN B')
    expect(saveButton()).toBeEnabled()
  })

  it('không tải được cài đặt -> hiện lỗi, không có form', async () => {
    vi.mocked(getUserSettings).mockRejectedValue({ code: 'X', message: 'Mất kết nối' })
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối')
    expect(screen.queryByLabelText(LABEL)).toBeNull()
  })
})
