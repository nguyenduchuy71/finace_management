import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings, X, MessageCircle, Trash2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatSettings } from './ChatSettings'
import { ConversationStarters } from './ConversationStarters'

export function ChatPanel() {
  const { isOpen, messages, isLoading, showSettings, toggleSettings, closeChat, toggleChat, clearMessages } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [prefillText, setPrefillText] = useState<string | undefined>()
  const handlePrefillConsumed = useCallback(() => setPrefillText(undefined), [])

  // Keyboard shortcut: Ctrl+Shift+K (Win/Linux) or Cmd+Shift+K (Mac) toggles chat
  // Register OUTSIDE the early return so shortcut works when panel is closed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modifier = isMac ? e.metaKey : e.ctrlKey
      if (modifier && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault()
        toggleChat()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleChat])

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen])

  if (!isOpen) return null

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        onClick={closeChat}
        aria-hidden="true"
      />

      {/* Panel — mobile: bottom sheet; desktop: bottom-right fixed panel */}
      <div className="fixed z-50 bg-background border border-border shadow-2xl flex flex-col overflow-hidden
        bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
        sm:bottom-20 sm:right-4 sm:left-auto sm:w-[380px] sm:h-[520px] sm:rounded-2xl sm:max-h-none">

        {/* Header */}
        <div className="flex items-center justify-between section-padding-x py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            {/* heading-label: text-sm font-medium leading-snug for panel title */}
            <span className="heading-label">Trợ lý tài chính</span>
          </div>
          <div className="flex items-center gap-1">
            {hasMessages && (
              <Button
                variant="ghost"
                size="icon"
                className="touch-target text-muted-foreground hover:text-destructive transition-colors duration-200"
                onClick={clearMessages}
                title="Xóa lịch sử chat"
                aria-label="Xóa lịch sử chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="touch-target transition-colors duration-200"
              onClick={toggleSettings}
              aria-label="Cài đặt API"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="touch-target transition-colors duration-200"
              onClick={closeChat}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings (collapsible inline section) */}
        {showSettings && <ChatSettings />}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!hasMessages && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-4">
              <MessageCircle className="h-8 w-8 opacity-40" />
              <ConversationStarters onSelect={setPrefillText} />
              <p className="text-xs text-muted-foreground/60">Ctrl+Shift+K để mở/đóng</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Typing indicator — shown while waiting for LLM response */}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="flex items-start gap-2">
                <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput inputRef={inputRef} prefillText={prefillText} onPrefillConsumed={handlePrefillConsumed} />
      </div>
    </>
  )
}
