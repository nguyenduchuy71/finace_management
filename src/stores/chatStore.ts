import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: number
}

export interface ApiConfig {
  endpoint: string
  apiKey: string
}

interface ChatState {
  isOpen: boolean
  messages: ChatMessage[]
  isLoading: boolean
  apiConfig: ApiConfig | null
  showSettings: boolean
  // Actions
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setApiConfig: (config: ApiConfig | null) => void
  toggleSettings: () => void
}

function loadApiConfig(): ApiConfig | null {
  try {
    const stored = localStorage.getItem('finance-chat-api-config')
    if (!stored) return null
    return JSON.parse(stored) as ApiConfig
  } catch {
    return null
  }
}

function saveApiConfig(config: ApiConfig | null) {
  if (config) {
    localStorage.setItem('finance-chat-api-config', JSON.stringify(config))
  } else {
    localStorage.removeItem('finance-chat-api-config')
  }
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useChatStore = create<ChatState>()((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  apiConfig: loadApiConfig(),
  showSettings: false,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: generateId(), timestamp: Date.now() },
      ],
    })),

  clearMessages: () => set({ messages: [] }),
  setLoading: (isLoading) => set({ isLoading }),

  setApiConfig: (config) => {
    saveApiConfig(config)
    set({ apiConfig: config })
  },

  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
}))
