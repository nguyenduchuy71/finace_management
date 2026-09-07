import { getBankBrand } from './bank-branding'
import { cn } from '@/lib/utils'

interface BankLogoProps {
  bankName: string
  /** sm dùng trong danh sách, md dùng ở nút chọn/thẻ tóm tắt. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Ô vuông monogram đại diện ngân hàng.
 *
 * Dùng chữ + màu thay vì ảnh logo — lý do đầy đủ ở `bank-branding.ts`
 * (tóm tắt: CSP chặn ảnh ngoại vi, và logo là nhãn hiệu đã đăng ký).
 *
 * aria-hidden vì đây thuần trang trí: tên ngân hàng luôn nằm ngay cạnh dưới
 * dạng text, đọc màn hình đọc text đó chứ không cần đọc monogram.
 */
export function BankLogo({ bankName, size = 'sm', className }: BankLogoProps) {
  const brand = getBankBrand(bankName)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums',
        size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs',
        brand.className,
        className
      )}
    >
      {brand.short}
    </span>
  )
}
