import { create } from 'zustand'
import { readJSON, writeJSON, removeKey } from '@/lib/persisted-json'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: number
}

export interface ApiConfig {
  apiKey: string
  model: string  // e.g. 'claude-3-5-sonnet-20241022'
}

interface ChatState {
  isOpen: boolean
  messages: ChatMessage[]
  isLoading: boolean
  apiConfig: ApiConfig | null
  showSettings: boolean
  regenerateCallback: (() => void) | null
  // Actions
  toggleChat: () => void
  closeChat: () => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  setLoading: (loading: boolean) => void
  setApiConfig: (config: ApiConfig | null) => void
  toggleSettings: () => void
  setRegenerateCallback: (fn: (() => void) | null) => void
  /** Đăng xuất / đổi user: xoá lịch sử chat (chứa số liệu tài chính) và API key khỏi localStorage. */
  resetForSignOut: () => void
}

const HISTORY_KEY = 'finance-chat-history'
const API_CONFIG_KEY = 'finance-chat-api-config'

const isMessageList = (v: unknown): v is ChatMessage[] => Array.isArray(v)
const isApiConfig = (v: unknown): v is ApiConfig | null => typeof v === 'object' && v !== null

const loadMessages = () => readJSON<ChatMessage[]>(HISTORY_KEY, [], isMessageList)
const saveMessages = (messages: ChatMessage[]) => { writeJSON(HISTORY_KEY, messages) }
const loadApiConfig = () => readJSON<ApiConfig | null>(API_CONFIG_KEY, null, isApiConfig)

// Lỗi storage (Safari private / bị chặn): vẫn dùng được trong phiên, chỉ không nhớ sau khi tải lại
function saveApiConfig(config: ApiConfig | null) {
  if (config) writeJSON(API_CONFIG_KEY, config)
  else removeKey(API_CONFIG_KEY)
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useChatStore = create<ChatState>()((set) => ({
  isOpen: false,
  messages: loadMessages(),
  isLoading: false,
  apiConfig: loadApiConfig(),
  showSettings: false,
  regenerateCallback: null,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  closeChat: () => set({ isOpen: false }),

  addMessage: (msg) =>
    set((s) => {
      const newMessages = [
        ...s.messages,
        { ...msg, id: generateId(), timestamp: Date.now() },
      ]
      saveMessages(newMessages)
      return { messages: newMessages }
    }),

  clearMessages: () => {
    saveMessages([])
    set({ messages: [] })
  },

  deleteMessage: (id) =>
    set((s) => {
      const newMessages = s.messages.filter((m) => m.id !== id)
      saveMessages(newMessages)
      return { messages: newMessages }
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setApiConfig: (config) => {
    saveApiConfig(config)
    set({ apiConfig: config })
  },

  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),

  setRegenerateCallback: (fn) => set({ regenerateCallback: fn }),

  resetForSignOut: () => {
    saveMessages([])
    saveApiConfig(null)
    set({ isOpen: false, messages: [], isLoading: false, apiConfig: null, showSettings: false, regenerateCallback: null })
  },
}))
