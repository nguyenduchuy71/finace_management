import { create } from 'zustand'

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
  openChat: () => void
  closeChat: () => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  setLoading: (loading: boolean) => void
  setApiConfig: (config: ApiConfig | null) => void
  toggleSettings: () => void
  setRegenerateCallback: (fn: (() => void) | null) => void
}

const HISTORY_KEY = 'finance-chat-history'
const API_CONFIG_KEY = 'finance-chat-api-config'

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    if (!stored) return []
    return JSON.parse(stored) as ChatMessage[]
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function loadApiConfig(): ApiConfig | null {
  try {
    const stored = localStorage.getItem(API_CONFIG_KEY)
    if (!stored) return null
    return JSON.parse(stored) as ApiConfig
  } catch {
    return null
  }
}

function saveApiConfig(config: ApiConfig | null) {
  if (config) {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config))
  } else {
    localStorage.removeItem(API_CONFIG_KEY)
  }
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
  openChat: () => set({ isOpen: true }),
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
}))
