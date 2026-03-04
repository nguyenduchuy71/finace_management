import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { ChatButton } from '@/features/chatbot/ChatButton'
import { ChatPanel } from '@/features/chatbot/ChatPanel'

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      {/* Main content area — section-padding-x for horizontal, py-6 for vertical breathing room */}
      <main className="max-w-5xl mx-auto section-padding-x py-6 section-spacing">
        <Outlet />
      </main>
      {/* Chat feature — fixed positioned, doesn't affect layout */}
      <ChatButton />
      <ChatPanel />
    </div>
  )
}
