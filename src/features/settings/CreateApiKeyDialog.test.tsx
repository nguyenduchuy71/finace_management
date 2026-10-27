import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/api-keys', () => ({
  listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn(),
}))

import { createApiKey } from '@/services/api-keys'
import { CreateApiKeyDialog, INGEST_URL } from './CreateApiKeyDialog'

const FULL_KEY = 'vj_live_full_secret_value_1234'
const writeText = vi.fn()

function renderDialog() {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<CreateApiKeyDialog open onOpenChange={onOpenChange} />, { wrapper })
  return { onOpenChange }
}

const nameInput = () => screen.getByLabelText('Tên key')
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Tạo key' }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createApiKey).mockReset()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('CreateApiKeyDialog — bước 1: đặt tên', () => {
  it('mở ra có tên mặc định "iPhone" và CHƯA hiện key', () => {
    renderDialog()
    expect(nameInput()).toHaveValue('iPhone')
    expect(screen.queryByLabelText('API key')).toBeNull()
  })

  it.each([
    ['chuỗi rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['51 ký tự (quá giới hạn)', 'a'.repeat(51)],
  ])('tên %s -> KHÔNG gọi createApiKey, báo lỗi', (_label, value) => {
    renderDialog()
    fireEvent.change(nameInput(), { target: { value } })
    submit()
    expect(createApiKey).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Tên key 1–50 ký tự.')
  })

  it('đúng 50 ký tự là hợp lệ (biên trên)', async () => {
    vi.mocked(createApiKey).mockResolvedValue(FULL_KEY)
    renderDialog()
    fireEvent.change(nameInput(), { target: { value: 'a'.repeat(50) } })
    submit()
    await waitFor(() => expect(createApiKey).toHaveBeenCalledWith('a'.repeat(50)))
  })

  it('gửi tên đã trim; key hiện SAU KHI tạo, kèm URL Shortcut', async () => {
    vi.mocked(createApiKey).mockResolvedValue(FULL_KEY)
    renderDialog()
    fireEvent.change(nameInput(), { target: { value: '  iPad  ' } })
    submit()

    expect(await screen.findByDisplayValue(FULL_KEY)).toBeInTheDocument()
    expect(createApiKey).toHaveBeenCalledTimes(1)
    expect(createApiKey).toHaveBeenCalledWith('iPad')
    expect(screen.getByRole('heading', { name: 'Key “iPad” đã tạo' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(INGEST_URL)).toBeInTheDocument()
    // Form nhập tên đã biến mất: không tạo trùng khi bấm lại.
    expect(screen.queryByLabelText('Tên key')).toBeNull()
  })

  it('đang tạo -> nút hiện "Đang tạo…" và disabled', async () => {
    let finish: (v: string) => void = () => {}
    vi.mocked(createApiKey).mockReturnValue(new Promise<string>((r) => { finish = r }))
    renderDialog()
    submit()
    expect(await screen.findByRole('button', { name: 'Đang tạo…' })).toBeDisabled()
    finish(FULL_KEY)
    expect(await screen.findByDisplayValue(FULL_KEY)).toBeInTheDocument()
  })

  it('service lỗi -> hiện message, KHÔNG hiện key', async () => {
    vi.mocked(createApiKey).mockRejectedValue({
      code: '22023',
      message: 'Không tạo được key: tên phải 1–50 ký tự và tối đa 10 key còn hiệu lực.',
    })
    renderDialog()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('tối đa 10 key còn hiệu lực')
    expect(screen.queryByLabelText('API key')).toBeNull()
    expect(screen.getByLabelText('Tên key')).toBeInTheDocument()
  })

  it('Huỷ -> đóng dialog, không tạo key', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(createApiKey).not.toHaveBeenCalled()
  })
})

describe('CreateApiKeyDialog — bước 2: hiện key đúng một lần', () => {
  beforeEach(() => {
    vi.mocked(createApiKey).mockResolvedValue(FULL_KEY)
  })

  it('nút "Sao chép key" gọi navigator.clipboard.writeText với đúng key', async () => {
    renderDialog()
    submit()
    await screen.findByDisplayValue(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép key' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FULL_KEY))
  })

  it('nút "Sao chép URL" gọi writeText với URL Shortcut', async () => {
    renderDialog()
    submit()
    await screen.findByDisplayValue(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép URL' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(INGEST_URL))
    expect(INGEST_URL.endsWith('/functions/v1/parse-transaction')).toBe(true)
  })

  it('clipboard bị chặn -> không văng lỗi, nút vẫn dùng được (user copy tay)', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'))
    renderDialog()
    submit()
    await screen.findByDisplayValue(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép key' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FULL_KEY))
    expect(screen.getByRole('button', { name: 'Sao chép key' })).toBeEnabled()
    expect(screen.getByDisplayValue(FULL_KEY)).toBeInTheDocument()
  })

  it('cảnh báo chỉ hiện một lần và nút "Tôi đã lưu key" đóng dialog', async () => {
    const { onOpenChange } = renderDialog()
    submit()
    expect(await screen.findByText(/chỉ hiện/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tôi đã lưu key' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('đang hiện key: Esc và nút X KHÔNG đóng dialog (lỡ tay là mất key vĩnh viễn)', async () => {
    const { onOpenChange } = renderDialog()
    submit()
    const keyInput = await screen.findByDisplayValue(FULL_KEY)
    fireEvent.keyDown(keyInput, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue(FULL_KEY)).toBeInTheDocument()
  })

  it('CHƯA tạo key: Esc vẫn đóng như dialog thường', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.keyDown(nameInput(), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
