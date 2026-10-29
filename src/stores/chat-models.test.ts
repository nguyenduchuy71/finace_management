import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, normalizeChatModel } from './chat-models'

const API_CONFIG_KEY = 'finance-chat-api-config'

describe('chat-models', () => {
  it('mặc định là Sonnet 5.5 và nằm trong danh sách', () => {
    expect(DEFAULT_CHAT_MODEL).toBe('claude-sonnet-5-5')
    expect(CHAT_MODELS.map((m) => m.value)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'])
  })

  it('giữ model hợp lệ, đổi model cũ/lạ/không phải chuỗi về mặc định', () => {
    expect(normalizeChatModel('claude-haiku-5-5')).toBe('claude-haiku-5-5')
    expect(normalizeChatModel('claude-3-5-sonnet-20241022')).toBe(DEFAULT_CHAT_MODEL)
    expect(normalizeChatModel('')).toBe(DEFAULT_CHAT_MODEL)
    expect(normalizeChatModel(undefined)).toBe(DEFAULT_CHAT_MODEL)
  })
})

describe('chatStore nạp apiConfig đã lưu', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('migrate model Claude 3 cũ về mặc định, giữ nguyên API key', async () => {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify({ apiKey: 'sk-old', model: 'claude-3-opus-20240229' }))
    const { useChatStore } = await import('./chatStore')
    expect(useChatStore.getState().apiConfig).toEqual({ apiKey: 'sk-old', model: DEFAULT_CHAT_MODEL })
  })

  it('giữ nguyên model hợp lệ đã lưu', async () => {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify({ apiKey: 'k', model: 'claude-opus-5-5' }))
    const { useChatStore } = await import('./chatStore')
    expect(useChatStore.getState().apiConfig).toEqual({ apiKey: 'k', model: 'claude-opus-5-5' })
  })
})
