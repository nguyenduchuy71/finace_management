import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useChatStore } from '@/stores/chatStore'
import { ChatPanel } from './ChatPanel'

// Mock useChatApi so we don't make real API calls in component tests
vi.mock('./useChatApi', () => ({
  useChatApi: () => ({
    sendMessage: vi.fn(),
    isLoading: false,
  }),
}))

// Mock react-markdown to avoid ESM parsing issues in jsdom
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => children,
}))

// Mock sonner toast to avoid portal issues
vi.mock('sonner', () => ({
  toast: vi.fn(),
  Toaster: () => null,
}))

describe('ChatPanel', () => {
  beforeEach(() => {
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
    vi.restoreAllMocks()
  })

  describe('visibility', () => {
    it('renders nothing when chat is closed', () => {
      useChatStore.setState({ isOpen: false })
      const { container } = render(<ChatPanel />)
      expect(container.firstChild).toBeNull()
    })

    it('renders the panel when isOpen is true', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)
      expect(screen.getByText('Trợ lý tài chính')).toBeInTheDocument()
    })

    it('shows the close button when open', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)
      expect(screen.getByLabelText('Đóng')).toBeInTheDocument()
    })

    it('closes panel when close button is clicked', async () => {
      const user = userEvent.setup()
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      await user.click(screen.getByLabelText('Đóng'))
      expect(useChatStore.getState().isOpen).toBe(false)
    })
  })

  describe('keyboard shortcut', () => {
    it('toggles chat open with Ctrl+Shift+K', () => {
      useChatStore.setState({ isOpen: false })
      render(<ChatPanel />)

      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, code: 'KeyK' })
      expect(useChatStore.getState().isOpen).toBe(true)
    })

    it('toggles chat closed with Ctrl+Shift+K when open', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, code: 'KeyK' })
      expect(useChatStore.getState().isOpen).toBe(false)
    })

    it('Ctrl+Shift+K works even when panel is closed (no early return for keyboard)', () => {
      useChatStore.setState({ isOpen: false })
      const { container } = render(<ChatPanel />)
      // Panel renders nothing when closed, but keyboard listener is still active
      expect(container.firstChild).toBeNull()

      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, code: 'KeyK' })
      expect(useChatStore.getState().isOpen).toBe(true)
    })

    it('does not toggle on Ctrl+K without Shift', () => {
      useChatStore.setState({ isOpen: false })
      render(<ChatPanel />)

      fireEvent.keyDown(document, { ctrlKey: true, shiftKey: false, code: 'KeyK' })
      expect(useChatStore.getState().isOpen).toBe(false)
    })
  })

  describe('empty state', () => {
    it('shows empty state hint when no messages', () => {
      useChatStore.setState({ isOpen: true, messages: [] })
      render(<ChatPanel />)

      expect(screen.getByText('Hỏi về giao dịch của bạn')).toBeInTheDocument()
    })

    it('shows keyboard shortcut hint in empty state', () => {
      useChatStore.setState({ isOpen: true, messages: [] })
      render(<ChatPanel />)

      expect(screen.getByText('Ctrl+Shift+K để mở/đóng')).toBeInTheDocument()
    })
  })

  describe('messages', () => {
    it('renders user messages', () => {
      useChatStore.setState({
        isOpen: true,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello chatbot', timestamp: Date.now() },
        ],
      })
      render(<ChatPanel />)

      expect(screen.getByText('Hello chatbot')).toBeInTheDocument()
    })

    it('renders assistant messages', () => {
      useChatStore.setState({
        isOpen: true,
        messages: [
          { id: 'msg-1', role: 'assistant', content: 'I can help with your finances', timestamp: Date.now() },
        ],
      })
      render(<ChatPanel />)

      expect(screen.getByText('I can help with your finances')).toBeInTheDocument()
    })

    it('renders error messages', () => {
      useChatStore.setState({
        isOpen: true,
        messages: [
          { id: 'msg-1', role: 'error', content: 'API connection failed', timestamp: Date.now() },
        ],
      })
      render(<ChatPanel />)

      expect(screen.getByText('API connection failed')).toBeInTheDocument()
    })

    it('shows multiple messages in order', () => {
      useChatStore.setState({
        isOpen: true,
        messages: [
          { id: 'msg-1', role: 'user', content: 'First message', timestamp: 1000 },
          { id: 'msg-2', role: 'assistant', content: 'Second message', timestamp: 2000 },
        ],
      })
      render(<ChatPanel />)

      expect(screen.getByText('First message')).toBeInTheDocument()
      expect(screen.getByText('Second message')).toBeInTheDocument()
    })
  })

  describe('loading/typing indicator', () => {
    it('shows typing indicator when isLoading is true', () => {
      useChatStore.setState({ isOpen: true, isLoading: true, messages: [] })
      render(<ChatPanel />)

      // Typing indicator is rendered as animated dots — check for the animated bounce spans
      const bounceDots = document.querySelectorAll('.animate-bounce')
      expect(bounceDots.length).toBeGreaterThan(0)
    })

    it('hides typing indicator when isLoading is false', () => {
      useChatStore.setState({ isOpen: true, isLoading: false, messages: [] })
      render(<ChatPanel />)

      const bounceDots = document.querySelectorAll('.animate-bounce')
      expect(bounceDots.length).toBe(0)
    })
  })

  describe('settings', () => {
    it('shows settings button', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      expect(screen.getByLabelText('Cài đặt API')).toBeInTheDocument()
    })

    it('toggles settings panel when settings button clicked', async () => {
      const user = userEvent.setup()
      useChatStore.setState({ isOpen: true, showSettings: false })
      render(<ChatPanel />)

      await user.click(screen.getByLabelText('Cài đặt API'))
      expect(useChatStore.getState().showSettings).toBe(true)
    })
  })

  describe('clear messages button', () => {
    it('shows clear button when there are messages', () => {
      useChatStore.setState({
        isOpen: true,
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() }],
      })
      render(<ChatPanel />)

      expect(screen.getByLabelText('Xóa lịch sử chat')).toBeInTheDocument()
    })

    it('hides clear button when no messages', () => {
      useChatStore.setState({ isOpen: true, messages: [] })
      render(<ChatPanel />)

      expect(screen.queryByLabelText('Xóa lịch sử chat')).not.toBeInTheDocument()
    })

    it('clears messages when clear button clicked', async () => {
      const user = userEvent.setup()
      useChatStore.setState({
        isOpen: true,
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() }],
      })
      render(<ChatPanel />)

      await user.click(screen.getByLabelText('Xóa lịch sử chat'))
      expect(useChatStore.getState().messages).toHaveLength(0)
    })
  })

  describe('mobile backdrop', () => {
    it('renders mobile backdrop overlay when open', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      // Backdrop div has aria-hidden and bg-black/40 class
      const backdrop = document.querySelector('[aria-hidden="true"]')
      expect(backdrop).toBeInTheDocument()
    })

    it('closes chat when backdrop is clicked', async () => {
      const user = userEvent.setup()
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      const backdrop = document.querySelector('[aria-hidden="true"]')
      if (backdrop) {
        await user.click(backdrop)
        expect(useChatStore.getState().isOpen).toBe(false)
      }
    })
  })

  describe('input area', () => {
    it('renders the message input textarea', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      expect(screen.getByPlaceholderText(/Hỏi về giao dịch/)).toBeInTheDocument()
    })

    it('renders the send button', () => {
      useChatStore.setState({ isOpen: true })
      render(<ChatPanel />)

      expect(screen.getByLabelText('Gửi tin nhắn')).toBeInTheDocument()
    })
  })
})
