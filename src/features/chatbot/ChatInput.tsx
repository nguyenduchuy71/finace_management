import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatApi } from './useChatApi'

export function ChatInput({ inputRef, prefillText, onPrefillConsumed }: {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  prefillText?: string
  onPrefillConsumed?: () => void
} = {}) {
  const [text, setText] = useState('')
  const { sendMessage, isLoading } = useChatApi()
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef || internalRef

  // Điền sẵn từ ConversationStarters. Điều chỉnh state NGAY TRONG LÚC RENDER (mẫu React khuyến nghị
  // thay cho setState trong effect, vốn gây thêm một lượt render thừa): chỉ điền khi gặp prefill MỚI.
  // Cha xoá prefill sau khi dùng (prefillText -> undefined) nên phải đặt lại `appliedPrefill`, nếu
  // không thì chọn lại ĐÚNG gợi ý đó lần nữa sẽ bị coi là đã áp dụng và không điền.
  const [appliedPrefill, setAppliedPrefill] = useState<string | undefined>()
  if (prefillText !== appliedPrefill) {
    setAppliedPrefill(prefillText)
    if (prefillText) setText(prefillText)
  }

  // Tác dụng phụ thật (không phải setState của chính component này): báo cha đã dùng và focus.
  useEffect(() => {
    if (prefillText) {
      onPrefillConsumed?.()
      textareaRef.current?.focus()
    }
  }, [prefillText, onPrefillConsumed, textareaRef])

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    sendMessage(trimmed)
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border bg-background">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Hỏi về giao dịch của bạn... (Enter để gửi)"
        disabled={isLoading}
        rows={1}
        className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 min-h-[44px] max-h-[120px]"
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!text.trim() || isLoading}
        className="shrink-0 min-h-[44px] min-w-[44px]"
        aria-label="Gửi tin nhắn"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
