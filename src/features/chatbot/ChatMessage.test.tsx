import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import { ChatMessage } from './ChatMessage'
import { useChatStore } from '@/stores/chatStore'
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore'

describe('ChatMessage - Mobile Tap-to-Reveal', () => {
  const mockMessage: ChatMessageType = {
    id: '1',
    role: 'assistant',
    content: 'Test response',
    timestamp: new Date().toISOString(),
  }

  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isLoading: false,
    })
    vi.clearAllMocks()
  })

  it('renders assistant message with action buttons', () => {
    render(<ChatMessage message={mockMessage} />)

    expect(screen.getByRole('button', { name: /Sao chép/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo lại/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xóa/ })).toBeInTheDocument()
  })

  it('renders user message with delete button', () => {
    const userMessage: ChatMessageType = {
      id: '2',
      role: 'user',
      content: 'User question',
      timestamp: new Date().toISOString(),
    }

    render(<ChatMessage message={userMessage} />)
    expect(screen.getByRole('button', { name: /Xóa tin nhắn/ })).toBeInTheDocument()
  })

  it('action buttons container has opacity-0 by default', () => {
    const { container } = render(<ChatMessage message={mockMessage} />)

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    // Find the actions container
    const actionsDiv = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('flex gap-1') && el.className.includes('opacity-')
    )

    expect(actionsDiv?.className).toContain('opacity-0')
  })

  it('copy button calls handleCopy with message content', async () => {
    const user = userEvent.setup()
    render(<ChatMessage message={mockMessage} />)

    // Mock clipboard API
    const clipboardSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined)

    const copyButton = screen.getByRole('button', { name: /Sao chép/ })
    await user.click(copyButton)

    expect(clipboardSpy).toHaveBeenCalledWith('Test response')
    clipboardSpy.mockRestore()
  })

  it('delete button removes message from store', async () => {
    const user = userEvent.setup()
    useChatStore.setState({ messages: [mockMessage] })
    render(<ChatMessage message={mockMessage} />)

    const deleteButton = screen.getByRole('button', { name: /Xóa/ })
    await user.click(deleteButton)

    // Verify message was deleted from store
    expect(useChatStore.getState().messages.length).toBe(0)
  })

  it('error message renders with destructive styling', () => {
    const errorMessage: ChatMessageType = {
      id: '3',
      role: 'error',
      content: 'An error occurred',
      timestamp: new Date().toISOString(),
    }

    const { container } = render(<ChatMessage message={errorMessage} />)
    expect(screen.getByText('An error occurred')).toBeInTheDocument()
    // Error message should have destructive/error styling
    const errorDiv = container.querySelector('[class*="destructive"]')
    expect(errorDiv).toBeInTheDocument()
  })

  it('assistant message displays content with markdown support', () => {
    const markdownMessage: ChatMessageType = {
      id: '4',
      role: 'assistant',
      content: '# Heading\n\nParagraph with **bold** text.',
      timestamp: new Date().toISOString(),
    }

    render(<ChatMessage message={markdownMessage} />)
    expect(screen.getByText(/Heading/, { selector: 'h1' })).toBeInTheDocument()
  })

  it('user message displays in correct layout (right-aligned)', () => {
    const userMessage: ChatMessageType = {
      id: '5',
      role: 'user',
      content: 'Test user message',
      timestamp: new Date().toISOString(),
    }
    const { container } = render(<ChatMessage message={userMessage} />)
    const messageGroup = container.querySelector('[class*="justify-end"]')

    // User messages should use justify-end
    expect(messageGroup).toBeInTheDocument()
    expect(messageGroup?.className).toContain('justify-end')
  })

  it('cleanup on unmount does not throw', () => {
    const { unmount } = render(<ChatMessage message={mockMessage} />)
    expect(() => unmount()).not.toThrow()
  })

  it('message content is correctly displayed', () => {
    render(<ChatMessage message={mockMessage} />)
    expect(screen.getByText('Test response')).toBeInTheDocument()
  })

  it('regenerate button is disabled when loading', async () => {
    useChatStore.setState({ isLoading: true })
    render(<ChatMessage message={mockMessage} />)

    const regenerateButton = screen.getByRole('button', { name: /Tạo lại/ })
    expect(regenerateButton).toBeDisabled()
  })
})
