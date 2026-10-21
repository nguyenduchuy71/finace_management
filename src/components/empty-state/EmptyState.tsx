import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** `success`: trạng thái tốt (vd hộp tin đã xử lý hết) — tông thu thay cho tông thương hiệu. */
  tone?: 'brand' | 'success'
  /** Khung viền đứt — dùng khi đứng riêng giữa trang (không nằm trong card). */
  bordered?: boolean
}

/**
 * Màn hình trống dùng chung: icon trên nền vòng tròn đồng tâm (SVG inline — CSP `img-src 'self'`
 * chặn ảnh ngoài), tiêu đề, mô tả và hành động tuỳ chọn.
 */
export function EmptyState({ icon: Icon, title, description, action, tone = 'brand', bordered = false }: EmptyStateProps) {
  const color = tone === 'success' ? 'text-income' : 'text-primary'
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', bordered && 'rounded-2xl border border-dashed')}>
      <div className={cn('relative mb-4 flex h-24 w-24 items-center justify-center', color)}>
        <svg aria-hidden viewBox="0 0 96 96" className="absolute inset-0 h-full w-full">
          <circle cx="48" cy="48" r="46" fill="currentColor" opacity="0.05" />
          <circle cx="48" cy="48" r="34" fill="currentColor" opacity="0.08" />
          <circle cx="48" cy="48" r="22" fill="currentColor" opacity="0.14" />
          <circle cx="80" cy="20" r="3" fill="currentColor" opacity="0.35" />
          <circle cx="14" cy="66" r="2" fill="currentColor" opacity="0.3" />
        </svg>
        <Icon aria-hidden className="relative h-8 w-8" />
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
