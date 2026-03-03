import { Sun, Moon, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/themeStore'

export function AppHeader() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg tracking-tight">FinanceManager</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/accounts"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center ${
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
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`
            }
          >
            Thẻ tín dụng
          </NavLink>
        </nav>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
          className="min-h-[44px] min-w-[44px]"
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
