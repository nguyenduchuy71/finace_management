import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { AlertCircle, Bot, User, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useChatStore } from '@/stores/chatStore'
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore'

interface ChatMessageProps {
  message: ChatMessageType
}

const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export function ChatMessage({ message }: ChatMessageProps) {
  const { deleteMessage, regenerateCallback, isLoading } = useChatStore()
  const [showActions, setShowActions] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const isAssistant = message.role === 'assistant'

  const handleTouchStart = () => {
    setShowActions(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setShowActions(false), 4000)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      toast('Đã sao chép tin nhắn')
    }).catch(() => {
      toast.error('Không thể sao chép')
    })
  }

  function handleDelete() {
    deleteMessage(message.id)
  }

  function handleRegenerate() {
    // Delete this assistant message first, then trigger regenerate
    deleteMessage(message.id)
    if (regenerateCallback && !isLoading) {
      regenerateCallback()
    }
  }

  if (isUser) {
    return (
      <div
        className="group flex justify-end mb-3"
        onTouchStart={IS_TOUCH_DEVICE ? handleTouchStart : undefined}
      >
        <div className="flex flex-col items-end gap-1 max-w-[85%]">
          <div className="flex items-end gap-2">
            {/* body-sm with leading-relaxed for readable chat bubbles */}
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 body-sm">
              {message.content}
            </div>
            <div className="shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
          </div>
          {/* Delete button — visible on hover (desktop) or mobile tap-to-reveal */}
          <div className={`flex gap-1 transition-opacity duration-200 ${
            IS_TOUCH_DEVICE
              ? (showActions ? 'opacity-100' : 'opacity-0')
              : 'opacity-0 group-hover:opacity-100'
          }`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors duration-200"
              onClick={handleDelete}
              title="Xóa tin nhắn"
              aria-label="Xóa tin nhắn"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex justify-start mb-3">
        <div className="flex items-start gap-2 max-w-[90%]">
          <div className="shrink-0 w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          </div>
          {/* body-sm for error text — consistent with other message bubbles */}
          <div className="bg-destructive/10 text-destructive rounded-2xl rounded-tl-sm px-3 py-2 body-sm border border-destructive/20">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Assistant message with markdown + action buttons
  return (
    <div
      className="group flex justify-start mb-3"
      onTouchStart={IS_TOUCH_DEVICE ? handleTouchStart : undefined}
    >
      <div className="flex flex-col items-start gap-1 max-w-[90%]">
        <div className="flex items-start gap-2">
          <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {/* body-sm with prose for markdown — leading-relaxed for readability */}
          <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-3 py-2 body-sm prose prose-sm dark:prose-invert max-w-none
            [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5
            [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
            [&_pre]:bg-background [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
        {/* Action buttons — visible on hover (desktop) or mobile tap-to-reveal */}
        <div className={`flex gap-1 ml-8 transition-opacity duration-200 ${
          IS_TOUCH_DEVICE
            ? (showActions ? 'opacity-100' : 'opacity-0')
            : 'opacity-0 group-hover:opacity-100'
        }`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors duration-200"
            onClick={handleCopy}
            title="Sao chép"
            aria-label="Sao chép tin nhắn"
          >
            <Copy className="h-3 w-3" />
          </Button>
          {isAssistant && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors duration-200"
              onClick={handleRegenerate}
              disabled={isLoading}
              title="Tạo lại"
              aria-label="Tạo lại phản hồi"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors duration-200"
            onClick={handleDelete}
            title="Xóa"
            aria-label="Xóa tin nhắn"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
