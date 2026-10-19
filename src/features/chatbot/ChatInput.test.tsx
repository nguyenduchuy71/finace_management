import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'

const chat = vi.hoisted(() => ({ sendMessage: vi.fn(), isLoading: false }))
vi.mock('./useChatApi', () => ({
  useChatApi: () => ({ sendMessage: chat.sendMessage, isLoading: chat.isLoading }),
}))

import { ChatInput } from './ChatInput'

const box = () => screen.getByPlaceholderText(/Hỏi về giao dịch/) as HTMLTextAreaElement

/** Giống ChatPanel: cha giữ prefillText, ChatInput báo "đã dùng" thì cha xoá nó. */
function Host({ onConsumed }: { onConsumed?: () => void }) {
  const [prefill, setPrefill] = useState<string | undefined>()
  const consumed = useCallback(() => { onConsumed?.(); setPrefill(undefined) }, [onConsumed])
  return (
    <>
      <button onClick={() => setPrefill('Tháng này chi bao nhiêu?')}>starter-a</button>
      <button onClick={() => setPrefill('Danh mục nào chi nhiều nhất?')}>starter-b</button>
      <ChatInput prefillText={prefill} onPrefillConsumed={consumed} />
    </>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  chat.isLoading = false
})

describe('ChatInput — gửi tin nhắn', () => {
  it('Enter gửi tin đã trim và xoá ô nhập; Shift+Enter không gửi', async () => {
    const u = userEvent.setup()
    render(<ChatInput />)
    await u.type(box(), '  xin chào  ')
    await u.keyboard('{Shift>}{Enter}{/Shift}')
    expect(chat.sendMessage).not.toHaveBeenCalled()

    await u.clear(box())
    await u.type(box(), '  xin chào  {Enter}')
    expect(chat.sendMessage).toHaveBeenCalledWith('xin chào')
    expect(box()).toHaveValue('')
  })

  it('ô trống hoặc đang tải: nút gửi bị khoá và không gửi', async () => {
    const u = userEvent.setup()
    const { rerender } = render(<ChatInput />)
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' })).toBeDisabled()
    await u.type(box(), '   {Enter}')
    expect(chat.sendMessage).not.toHaveBeenCalled()

    chat.isLoading = true
    rerender(<ChatInput />)
    expect(box()).toBeDisabled()
  })
})

describe('ChatInput — điền sẵn từ gợi ý hội thoại (prefill)', () => {
  it('điền nội dung gợi ý, báo đã dùng đúng một lần và focus ô nhập', async () => {
    const u = userEvent.setup()
    const onConsumed = vi.fn()
    render(<Host onConsumed={onConsumed} />)
    await u.click(screen.getByText('starter-a'))

    expect(box()).toHaveValue('Tháng này chi bao nhiêu?')
    expect(onConsumed).toHaveBeenCalledTimes(1)
    expect(box()).toHaveFocus()
  })

  // Cha xoá prefill sau khi dùng; chọn lại ĐÚNG gợi ý đó lần nữa vẫn phải điền lại.
  it('chọn lại cùng một gợi ý sau khi đã sửa/xoá nội dung vẫn điền lại', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.click(screen.getByText('starter-a'))
    await u.clear(box())
    expect(box()).toHaveValue('')

    await u.click(screen.getByText('starter-a'))
    expect(box()).toHaveValue('Tháng này chi bao nhiêu?')
  })

  it('chọn gợi ý khác thì thay nội dung', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.click(screen.getByText('starter-a'))
    await u.click(screen.getByText('starter-b'))
    expect(box()).toHaveValue('Danh mục nào chi nhiều nhất?')
  })

  it('người dùng đang gõ dở rồi chọn gợi ý: gợi ý ghi đè nội dung đang gõ', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.type(box(), 'đang gõ dở')
    await u.click(screen.getByText('starter-b'))
    expect(box()).toHaveValue('Danh mục nào chi nhiều nhất?')
  })

  it('sau khi điền, người dùng sửa tiếp được và gửi đi nội dung đã sửa', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.click(screen.getByText('starter-a'))
    await u.type(box(), ' (3 tháng gần nhất){Enter}')
    expect(chat.sendMessage).toHaveBeenCalledWith('Tháng này chi bao nhiêu? (3 tháng gần nhất)')
  })

  it('không có prefill: không gọi onPrefillConsumed, không điền gì', () => {
    const onConsumed = vi.fn()
    render(<ChatInput onPrefillConsumed={onConsumed} />)
    expect(onConsumed).not.toHaveBeenCalled()
    expect(box()).toHaveValue('')
  })

  it('mount ổn định, không vòng lặp render (đếm số lần báo đã dùng khi cha re-render)', async () => {
    const onConsumed = vi.fn()
    render(<Host onConsumed={onConsumed} />)
    await act(async () => {})
    expect(onConsumed).not.toHaveBeenCalled()
  })
})
