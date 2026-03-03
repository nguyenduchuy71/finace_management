import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chatStore'

export function ChatButton() {
  const { isOpen, toggleChat } = useChatStore()

  return (
    <Button
      onClick={toggleChat}
      size="icon"
      className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
      aria-label={isOpen ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <MessageCircle className="h-6 w-6" />
      )}
    </Button>
  )
}
