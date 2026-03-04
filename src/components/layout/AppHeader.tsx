import { Sun, Moon, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/themeStore'

export function AppHeader() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto section-padding-x h-14 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="heading-h3 tracking-tight">FinanceManager</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md heading-label transition-colors duration-200 touch-target flex items-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`
            }
          >
            Tổng quan
          </NavLink>
          <NavLink
            to="/accounts"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md heading-label transition-colors duration-200 touch-target flex items-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`
            }
          >
            Ngân hàng
          </NavLink>
          <NavLink
            to="/credit-cards"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md heading-label transition-colors duration-200 touch-target flex items-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`
            }
          >
            <span className="hidden sm:inline">Thẻ tín dụng</span>
            <span className="sm:hidden">Thẻ TD</span>
          </NavLink>
        </nav>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
          className="touch-target shrink-0 transition-colors duration-200"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  )
}
