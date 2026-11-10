import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Tên hiển thị của sản phẩm — đổi tên chỉ sửa ở đây (và `<title>` trong index.html). */
export const APP_NAME = 'FinanceManager'

/**
 * Logo (ô màu thương hiệu + tên) dùng chung cho header của app và trang giới thiệu.
 * `hideNameBelow`: dưới breakpoint đó chỉ hiện ô logo (tên vẫn có cho trình đọc màn hình).
 * Trang giới thiệu: 'sm' (375px từng tràn vì tên). Header app: 'lg' (768–1023px nav 4 mục + tên bị xuống dòng).
 */
const HIDE_NAME_CLASS = { sm: 'max-sm:sr-only', lg: 'max-lg:sr-only' } as const

export function BrandMark({ hideNameBelow }: { hideNameBelow?: keyof typeof HIDE_NAME_CLASS }) {
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Wallet className="h-4 w-4" />
      </span>
      <span className={cn('heading-h3 tracking-tight', hideNameBelow && HIDE_NAME_CLASS[hideNameBelow])}>{APP_NAME}</span>
    </>
  )
}
