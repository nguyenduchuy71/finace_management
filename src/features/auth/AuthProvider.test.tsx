import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'

type AuthCb = (event: string, session: { user: { id: string } } | null) => void

const auth = vi.hoisted(() => ({ cb: null as AuthCb | null, unsubscribe: () => {} }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (cb: AuthCb) => {
        auth.cb = cb
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
      },
    },
  },
}))

const clearCache = vi.hoisted(() => vi.fn())
vi.mock('@/lib/query-client', () => ({ queryClient: { clear: clearCache } }))

import { AuthProvider } from './AuthProvider'
import { useChatStore } from '@/stores/chatStore'

const session = (id: string) => ({ user: { id } })
const emit = (event: string, s: { user: { id: string } } | null) => act(() => auth.cb!(event, s))

function seedChat() {
  useChatStore.getState().addMessage({ role: 'user', content: 'Số dư của tôi?' })
  useChatStore.getState().setApiConfig({ apiKey: 'sk-test', model: 'm' })
}

beforeEach(() => {
  localStorage.clear()
  clearCache.mockClear()
  useChatStore.setState({ messages: [], apiConfig: null, isOpen: false })
  render(<AuthProvider><div /></AuthProvider>)
})

describe('AuthProvider — dọn dữ liệu khi đổi user', () => {
  it('reload cùng user (INITIAL_SESSION): GIỮ lịch sử chat và key', async () => {
    seedChat()
    await emit('INITIAL_SESSION', session('u1'))
    expect(clearCache).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().apiConfig).not.toBeNull()
  })

  it('đăng xuất: xoá cache, lịch sử chat và API key Claude', async () => {
    await emit('INITIAL_SESSION', session('u1'))
    seedChat()
    await emit('SIGNED_OUT', null)
    expect(clearCache).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().messages).toEqual([])
    expect(useChatStore.getState().apiConfig).toBeNull()
    expect(localStorage.getItem('finance-chat-api-config')).toBeNull()
  })

  it('user khác đăng nhập (phiên cũ hết hạn, không bấm đăng xuất): không thấy chat của user trước', async () => {
    await emit('INITIAL_SESSION', session('u1'))
    seedChat()
    await emit('SIGNED_IN', session('u2'))
    expect(useChatStore.getState().messages).toEqual([])
    expect(useChatStore.getState().apiConfig).toBeNull()
  })

  it('refresh token cùng user: không xoá gì', async () => {
    await emit('INITIAL_SESSION', session('u1'))
    seedChat()
    await emit('TOKEN_REFRESHED', session('u1'))
    expect(clearCache).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(1)
  })
})
