import { useEffect, useRef } from 'react'
import { Settings, X, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatSettings } from './ChatSettings'

export function ChatPanel() {
  const { isOpen, messages, showSettings, toggleSettings, closeChat } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Trợ lý tài chính</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSettings}
              aria-label="Cài đặt API"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={closeChat}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings (collapsible) */}
        {showSettings && <ChatSettings />}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">Hỏi về giao dịch của bạn</p>
              <p className="text-xs mt-1">Ví dụ: "Chi tiêu nhiều nhất tháng này là gì?"</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput />
      </div>
    </>
  )
}
