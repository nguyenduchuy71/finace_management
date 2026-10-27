import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { UnparsedCountBadge } from '@/features/unparsed/UnparsedCountBadge'
import { visibleNavItems } from './nav-items'
import { useIsAdmin } from '@/hooks/useAdmin'

/**
 * Thanh tab cố định đáy màn hình cho điện thoại (< sm) — dùng được bằng một tay.
 * Đệm safe-area để không nằm dưới thanh home của iPhone (index.html có viewport-fit=cover).
 */
export function MobileTabBar() {
  const navItems = visibleNavItems(useIsAdmin())
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {/* Số cột theo số mục đang hiện (admin có thêm "Quản trị") */}
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map(({ to, label, shortLabel, icon: Icon, showUnparsedBadge }) => (
          <li key={to}>
            <NavLink
              to={to}
              // Nhãn rút gọn chỉ để vừa cột; trình đọc màn hình vẫn đọc tên đầy đủ (chữ hiển thị nằm trong tên — WCAG 2.5.3).
              aria-label={shortLabel ? label : undefined}
              className={({ isActive }) => cn(
                'relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-200',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {({ isActive }) => (
                <>
                  {/* Vạch chỉ mục đang mở — ngoài màu chữ, để không chỉ dựa vào màu */}
                  <span
                    aria-hidden
                    className={cn('absolute top-0 h-0.5 w-10 rounded-full', isActive ? 'bg-primary' : 'bg-transparent')}
                  />
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {showUnparsedBadge && (
                      <UnparsedCountBadge className="absolute -right-3 -top-2 h-4 min-w-4 px-1 text-[10px]" />
                    )}
                  </span>
                  {shortLabel ?? label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
