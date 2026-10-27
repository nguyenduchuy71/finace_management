import { Wallet } from 'lucide-react'

/** Tên hiển thị của sản phẩm — đổi tên chỉ sửa ở đây (và `<title>` trong index.html). */
export const APP_NAME = 'FinanceManager'

/** Logo (ô màu thương hiệu + tên) dùng chung cho header của app và trang giới thiệu. */
export function BrandMark() {
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Wallet className="h-4 w-4" />
      </span>
      <span className="heading-h3 tracking-tight">{APP_NAME}</span>
    </>
  )
}
