import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'
import { UnparsedCountBadge } from '@/features/unparsed/UnparsedCountBadge'
import { visibleNavItems } from './nav-items'
import { BrandMark } from './BrandMark'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useIsAdmin } from '@/hooks/useAdmin'

export function AppHeader() {
  const navItems = visibleNavItems(useIsAdmin())

  async function handleLogout() {
    // Clear TRƯỚC khi signOut: signOut() kích hoạt onAuthStateChange -> ProtectedRoute
    // điều hướng sang /login, các query đang bay có thể lỗi vì mất session.
    // Clear trước thì query bị huỷ, không còn gì để lỗi.
    // BẮT BUỘC có bước này: không clear thì user tiếp theo vẫn thấy data user trước.
    queryClient.clear()
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto section-padding-x h-14 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <BrandMark />
        </div>

        {/* Navigation — chỉ >= sm; điện thoại dùng MobileTabBar ở đáy */}
        <nav aria-label="Điều hướng chính" className="hidden sm:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon, showUnparsedBadge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg heading-label transition-colors duration-200 touch-target flex items-center gap-2 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {showUnparsedBadge && <UnparsedCountBadge />}
            </NavLink>
          ))}
        </nav>

        {/* Theme Toggle + Logout */}
        <div className="flex items-center gap-1 shrink-0">
        <ThemeToggleButton />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Đăng xuất"
          className="touch-target shrink-0 transition-colors duration-200"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        </div>
      </div>
    </header>
  )
}
