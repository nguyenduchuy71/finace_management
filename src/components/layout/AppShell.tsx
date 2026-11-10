import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'
import { ChatButton } from '@/features/chatbot/ChatButton'
import { ChatPanel } from '@/features/chatbot/ChatPanel'
import { SuspendedBanner } from '@/features/settings/SuspendedBanner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      {/* Main content area — section-padding-x for horizontal, py-6 for vertical breathing room */}
      {/* pb dưới cùng: chừa chỗ cho MobileTabBar (h-16) + nút trợ lý AI (đáy 5rem + 3rem) + safe-area,
          để nút/số tiền cuối trang không nằm dưới nút tròn. >= md nút ở bottom-4, cao 3.5rem. */}
      <main className="max-w-5xl mx-auto section-padding-x pt-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-24 section-spacing">
        <SuspendedBanner />
        <Outlet />
      </main>
      {/* Chat feature — fixed positioned, doesn't affect layout */}
      <MobileTabBar />
      <ChatButton />
      <ChatPanel />
    </div>
  )
}
