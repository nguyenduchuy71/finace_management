import { Link } from 'react-router-dom'
import { Moon, Sun, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/themeStore'

export function LandingHeader() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="FinanceManager — trang chủ">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="heading-h3 tracking-tight">FinanceManager</span>
        </Link>

        <nav aria-label="Trang giới thiệu" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#tinh-nang" className="hover:text-foreground">Tính năng</a>
          <a href="#cach-hoat-dong" className="hover:text-foreground">Cách hoạt động</a>
          <a href="#bao-mat" className="hover:text-foreground">Bảo mật</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon" onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" asChild><Link to="/login">Đăng nhập</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link to="/signup">Dùng miễn phí</Link></Button>
        </div>
      </div>
    </header>
  )
}
