import { Building2, CreditCard, LayoutDashboard, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  /** Nhãn cho thanh tab điện thoại khi `label` dài (5 cột ở 360px chỉ ~65px/cột). */
  shortLabel?: string
  icon: LucideIcon
  /** Hiện số tin chưa phân loại cạnh mục (chỉ trang ngân hàng). */
  showUnparsedBadge?: boolean
  /** Chỉ hiện cho admin (ẩn/hiện là tiện lợi; quyền thật kiểm ở function `admin`). */
  adminOnly?: boolean
}

/** Nguồn duy nhất cho điều hướng: header (>= sm) và thanh tab dưới (< sm) cùng đọc mảng này. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/accounts', label: 'Ngân hàng', icon: Building2, showUnparsedBadge: true },
  { to: '/credit-cards', label: 'Thẻ tín dụng', shortLabel: 'Thẻ', icon: CreditCard },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
  { to: '/admin', label: 'Quản trị', icon: ShieldCheck, adminOnly: true },
]

export function visibleNavItems(isAdmin: boolean): readonly NavItem[] {
  return isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.adminOnly)
}
