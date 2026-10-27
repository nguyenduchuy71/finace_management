import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useChatStore } from '@/stores/chatStore'

// Mock ở tầng hook dữ liệu — không chạm DB.
const mockTransactions = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => ({ data: mockTransactions.current }),
}))

// SDK giả: ghi lại `messages` gửi lên để kiểm lịch sử hội thoại.
const sdk = vi.hoisted(() => ({ calls: [] as { messages: unknown }[] }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      stream: async (req: { messages: unknown }) => {
        sdk.calls.push(req)
        return { finalMessage: async () => ({ content: [{ type: 'text', text: `Trả lời ${sdk.calls.length}` }] }) }
      },
    }
  },
}))

import { useChatApi } from './useChatApi'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

/**
 * Regression: `useChatApi` từng lặp render vô hạn ("Maximum update depth exceeded")
 * ngay khi mount, tức là VỠ NGAY khi user mở chat panel (ChatInput mount hook này).
 *
 * Chuỗi lỗi: flatMap trong thân render -> array mới mỗi render -> sendMessage đổi
 * identity -> useEffect đăng ký regenerate chạy lại -> setRegenerateCallback ghi
 * store -> useChatStore() trần (subscribe toàn store) re-render -> lặp lại.
 *
 * Toàn bộ đường chạy chatbot trước đây KHÔNG có test nào, nên 269 test vẫn xanh
 * trong khi tính năng hỏng hoàn toàn. Test này giữ cho điều đó không tái diễn.
 */
describe('useChatApi', () => {
  beforeEach(() => {
    mockTransactions.current = undefined
    useChatStore.setState({ messages: [], apiConfig: null, isLoading: false })
  })

  it('không lặp render vô hạn khi không có dữ liệu giao dịch', () => {
    let renders = 0
    renderHook(() => { renders++; return useChatApi() }, { wrapper })
    expect(renders).toBeLessThan(10)
  })

  it('không lặp render vô hạn khi CÓ dữ liệu giao dịch', () => {
    mockTransactions.current = {
      pages: [{ data: [
        { id: '1', transactionDate: '2026-01-01T00:00:00Z', description: 'Cafe', amount: -50000, type: 'expense' },
      ] }],
    }
    let renders = 0
    renderHook(() => { renders++; return useChatApi() }, { wrapper })
    expect(renders).toBeLessThan(10)
  })

  it('ổn định qua nhiều lần rerender (identity của sendMessage không đổi)', () => {
    mockTransactions.current = { pages: [{ data: [] }] }
    const { result, rerender } = renderHook(() => useChatApi(), { wrapper })
    const first = result.current.sendMessage
    rerender()
    rerender()
    expect(result.current.sendMessage).toBe(first)
  })

  it('"Tạo lại" không nhân đôi câu hỏi và không gửi lại câu trả lời đã xoá', async () => {
    sdk.calls = []
    mockTransactions.current = { pages: [{ data: [] }] }
    useChatStore.setState({ apiConfig: { apiKey: 'k', model: 'm' } })
    const { result } = renderHook(() => useChatApi(), { wrapper })

    await act(() => result.current.sendMessage('Tháng này chi bao nhiêu?'))
    const answer = useChatStore.getState().messages.find((m) => m.role === 'assistant')!

    // Đúng thứ tự ChatMessage.handleRegenerate: xoá câu trả lời rồi gọi callback.
    await act(async () => {
      useChatStore.getState().deleteMessage(answer.id)
      useChatStore.getState().regenerateCallback?.()
    })

    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false))
    await waitFor(() => expect(sdk.calls).toHaveLength(2))
    expect(sdk.calls[1].messages).toEqual([{ role: 'user', content: 'Tháng này chi bao nhiêu?' }])
    expect(useChatStore.getState().messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:Tháng này chi bao nhiêu?',
      'assistant:Trả lời 2',
    ])
  })
})
