import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { UnparsedCountBadge } from '@/features/unparsed/UnparsedCountBadge'
import { NAV_ITEMS } from './nav-items'

/**
 * Thanh tab cố định đáy màn hình cho điện thoại (< sm) — dùng được bằng một tay.
 * Đệm safe-area để không nằm dưới thanh home của iPhone (index.html có viewport-fit=cover).
 */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, showUnparsedBadge }) => (
          <li key={to}>
            <NavLink
              to={to}
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
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
