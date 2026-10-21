import { Building2, CreditCard, LayoutDashboard, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Hiện số tin chưa phân loại cạnh mục (chỉ trang ngân hàng). */
  showUnparsedBadge?: boolean
}

/** Nguồn duy nhất cho điều hướng: header (>= sm) và thanh tab dưới (< sm) cùng đọc mảng này. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/accounts', label: 'Ngân hàng', icon: Building2, showUnparsedBadge: true },
  { to: '/credit-cards', label: 'Thẻ tín dụng', icon: CreditCard },
]
