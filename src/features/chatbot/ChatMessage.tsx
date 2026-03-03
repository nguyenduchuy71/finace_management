import { AlertCircle, Bot, User } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="flex items-end gap-2 max-w-[85%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed">
            {message.content}
          </div>
          <div className="shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary-foreground" />
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
          <div className="bg-destructive/10 text-destructive rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed border border-destructive/20">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  )
}
