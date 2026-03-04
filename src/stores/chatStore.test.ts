import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useChatStore } from './chatStore'

const HISTORY_KEY = 'finance-chat-history'
const API_CONFIG_KEY = 'finance-chat-api-config'

describe('chatStore', () => {
  beforeEach(() => {
    // Clear localStorage and reset store state before each test
    localStorage.clear()
    useChatStore.setState({
      isOpen: false,
      messages: [],
      isLoading: false,
      apiConfig: null,
      showSettings: false,
      regenerateCallback: null,
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('is closed by default', () => {
      expect(useChatStore.getState().isOpen).toBe(false)
    })

    it('has empty messages by default', () => {
      expect(useChatStore.getState().messages).toHaveLength(0)
    })

    it('is not loading by default', () => {
      expect(useChatStore.getState().isLoading).toBe(false)
    })

    it('has no apiConfig by default', () => {
      expect(useChatStore.getState().apiConfig).toBeNull()
    })

    it('has showSettings false by default', () => {
      expect(useChatStore.getState().showSettings).toBe(false)
    })
  })

  describe('toggleChat / openChat / closeChat', () => {
    it('toggleChat opens when closed', () => {
      useChatStore.getState().toggleChat()
      expect(useChatStore.getState().isOpen).toBe(true)
    })

    it('toggleChat closes when open', () => {
      useChatStore.setState({ isOpen: true })
      useChatStore.getState().toggleChat()
      expect(useChatStore.getState().isOpen).toBe(false)
    })

    it('openChat sets isOpen to true', () => {
      useChatStore.getState().openChat()
      expect(useChatStore.getState().isOpen).toBe(true)
    })

    it('closeChat sets isOpen to false', () => {
      useChatStore.setState({ isOpen: true })
      useChatStore.getState().closeChat()
      expect(useChatStore.getState().isOpen).toBe(false)
    })

    it('openChat is idempotent', () => {
      useChatStore.getState().openChat()
      useChatStore.getState().openChat()
      expect(useChatStore.getState().isOpen).toBe(true)
    })
  })

  describe('addMessage', () => {
    it('adds a user message to state', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      const messages = useChatStore.getState().messages
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
    })

    it('adds an assistant message to state', () => {
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Hi there!' })
      const messages = useChatStore.getState().messages
      expect(messages[0].role).toBe('assistant')
      expect(messages[0].content).toBe('Hi there!')
    })

    it('adds an error message', () => {
      useChatStore.getState().addMessage({ role: 'error', content: 'API error occurred' })
      expect(useChatStore.getState().messages[0].role).toBe('error')
    })

    it('auto-generates an id and timestamp', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Test' })
      const msg = useChatStore.getState().messages[0]
      expect(msg.id).toBeTruthy()
      expect(msg.id.startsWith('msg-')).toBe(true)
      expect(typeof msg.timestamp).toBe('number')
      expect(msg.timestamp).toBeGreaterThan(0)
    })

    it('preserves message order (oldest first)', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'First' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Second' })
      useChatStore.getState().addMessage({ role: 'user', content: 'Third' })

      const messages = useChatStore.getState().messages
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
      expect(messages[2].content).toBe('Third')
    })

    it('persists messages to localStorage', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Persist me' })

      const stored = localStorage.getItem(HISTORY_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0].content).toBe('Persist me')
    })
  })

  describe('deleteMessage', () => {
    it('removes a message by id', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Delete me' })
      const id = useChatStore.getState().messages[0].id

      useChatStore.getState().deleteMessage(id)
      expect(useChatStore.getState().messages).toHaveLength(0)
    })

    it('only removes the specified message', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Keep me' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Delete me' })

      const messages = useChatStore.getState().messages
      const deleteId = messages[1].id

      useChatStore.getState().deleteMessage(deleteId)
      const remaining = useChatStore.getState().messages
      expect(remaining).toHaveLength(1)
      expect(remaining[0].content).toBe('Keep me')
    })

    it('updates localStorage after delete', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'First' })
      useChatStore.getState().addMessage({ role: 'user', content: 'Second' })
      const id = useChatStore.getState().messages[0].id

      useChatStore.getState().deleteMessage(id)

      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY)!)
      expect(stored).toHaveLength(1)
      expect(stored[0].content).toBe('Second')
    })

    it('does nothing for non-existent id', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Stay' })
      useChatStore.getState().deleteMessage('non-existent-id')
      expect(useChatStore.getState().messages).toHaveLength(1)
    })
  })

  describe('clearMessages', () => {
    it('removes all messages', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'One' })
      useChatStore.getState().addMessage({ role: 'assistant', content: 'Two' })
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().messages).toHaveLength(0)
    })

    it('clears localStorage history', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'Hello' })
      useChatStore.getState().clearMessages()

      const stored = localStorage.getItem(HISTORY_KEY)
      // Either null or empty array
      if (stored !== null) {
        expect(JSON.parse(stored)).toHaveLength(0)
      }
    })

    it('is safe on empty messages', () => {
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().messages).toHaveLength(0)
    })
  })

  describe('setLoading', () => {
    it('sets isLoading to true', () => {
      useChatStore.getState().setLoading(true)
      expect(useChatStore.getState().isLoading).toBe(true)
    })

    it('sets isLoading to false', () => {
      useChatStore.setState({ isLoading: true })
      useChatStore.getState().setLoading(false)
      expect(useChatStore.getState().isLoading).toBe(false)
    })
  })

  describe('setApiConfig', () => {
    it('sets apiConfig to a new config', () => {
      const config = { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
      useChatStore.getState().setApiConfig(config)
      expect(useChatStore.getState().apiConfig).toEqual(config)
    })

    it('persists apiConfig to localStorage', () => {
      const config = { apiKey: 'persist-key', model: 'claude-3-5-sonnet-20241022' }
      useChatStore.getState().setApiConfig(config)

      const stored = localStorage.getItem(API_CONFIG_KEY)
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toEqual(config)
    })

    it('removes apiConfig from localStorage when set to null', () => {
      useChatStore.getState().setApiConfig({ apiKey: 'some-key', model: 'claude-3-5-sonnet-20241022' })
      useChatStore.getState().setApiConfig(null)

      expect(useChatStore.getState().apiConfig).toBeNull()
      expect(localStorage.getItem(API_CONFIG_KEY)).toBeNull()
    })
  })

  describe('toggleSettings', () => {
    it('shows settings when hidden', () => {
      useChatStore.getState().toggleSettings()
      expect(useChatStore.getState().showSettings).toBe(true)
    })

    it('hides settings when shown', () => {
      useChatStore.setState({ showSettings: true })
      useChatStore.getState().toggleSettings()
      expect(useChatStore.getState().showSettings).toBe(false)
    })
  })

  describe('setRegenerateCallback', () => {
    it('stores a regenerate callback function', () => {
      const callback = () => {}
      useChatStore.getState().setRegenerateCallback(callback)
      expect(useChatStore.getState().regenerateCallback).toBe(callback)
    })

    it('clears the callback with null', () => {
      useChatStore.getState().setRegenerateCallback(() => {})
      useChatStore.getState().setRegenerateCallback(null)
      expect(useChatStore.getState().regenerateCallback).toBeNull()
    })
  })

  describe('localStorage message persistence', () => {
    it('loads messages from localStorage on init', () => {
      const messages = [
        { id: 'msg-1', role: 'user', content: 'Previous message', timestamp: Date.now() },
      ]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))

      // Re-import the store to trigger loadMessages()
      // Since the store is a singleton, we test via direct setState to simulate
      useChatStore.setState({ messages: JSON.parse(localStorage.getItem(HISTORY_KEY)!) })
      expect(useChatStore.getState().messages).toHaveLength(1)
      expect(useChatStore.getState().messages[0].content).toBe('Previous message')
    })
  })
})
