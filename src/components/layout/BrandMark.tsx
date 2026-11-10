import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Tên hiển thị của sản phẩm — đổi tên chỉ sửa ở đây (và `<title>` trong index.html). */
export const APP_NAME = 'FinanceManager'

/**
 * Logo (ô màu thương hiệu + tên) dùng chung cho header của app và trang giới thiệu.
 * `compact`: < sm chỉ hiện ô logo (tên vẫn có cho trình đọc màn hình) — header 375px từng tràn ngang vì tên.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Wallet className="h-4 w-4" />
      </span>
      <span className={cn('heading-h3 tracking-tight', compact && 'max-sm:sr-only')}>{APP_NAME}</span>
    </>
  )
}
