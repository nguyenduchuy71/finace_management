import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, BellRing, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/ui/CategoryBadge'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Vầng sáng nền theo màu thương hiệu — trang trí thuần, ẩn với trình đọc màn hình */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-primary/15 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div className="space-y-6 text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Ghi chép chi tiêu tự động từ thông báo ngân hàng
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Mọi khoản thu chi, <span className="text-primary">tự vào sổ</span> ngay khi ngân hàng báo
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
            FinanceManager đọc SMS và thông báo ngân hàng qua iOS Shortcut, phân loại giao dịch, theo dõi kỳ sao kê thẻ tín dụng
            và ước tính hoàn tiền — bạn không phải gõ tay từng khoản.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Button size="lg" asChild>
              <Link to="/signup">Tạo tài khoản miễn phí <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Tôi đã có tài khoản</Link>
            </Button>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  )
}

/** Minh hoạ tĩnh: một thông báo ngân hàng biến thành giao dịch đã phân loại. Số liệu là ví dụ. */
function HeroPreview() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-md space-y-3">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" /> Thông báo · LPBank · vừa xong
        </div>
        <p className="font-mono text-xs leading-relaxed text-card-foreground">
          TK ****x265 -150.000VND luc 12:05 27/10. ND: THANH TOAN PHO HA NOI. SD: 8.350.000VND
        </p>
      </div>

      <div className="flex justify-center text-primary">
        <ArrowDown className="h-5 w-5 motion-safe:animate-bounce" />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-lg ring-1 ring-primary/20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">Phở Hà Nội</p>
            <p className="text-xs text-muted-foreground">LPBank ****x265 · 12:05</p>
          </div>
          <span className="money font-semibold text-expense">- đ 150.000</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <CategoryBadge category="Ăn uống" />
          <span className="text-xs text-muted-foreground">Đã ghi tự động</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PreviewStat label="Thu tháng này" value="đ 25,4tr" tone="text-income" />
        <PreviewStat label="Chi tháng này" value="đ 12,1tr" tone="text-expense" />
        <PreviewStat label="Hoàn tiền" value="đ 186k" tone="text-cashback" />
      </div>
    </div>
  )
}

function PreviewStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`money mt-1 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
