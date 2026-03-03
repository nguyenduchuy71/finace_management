import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
