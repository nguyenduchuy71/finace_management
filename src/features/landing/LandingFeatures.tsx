import type { LucideIcon } from 'lucide-react'
import { BellRing, CreditCard, Inbox, PieChart, Percent, Download } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: BellRing,
    title: 'Tự nạp từ thông báo',
    description: 'iOS Shortcut gửi SMS / push ngân hàng về FinanceManager. 19 mẫu tin của các ngân hàng Việt Nam được nhận diện sẵn.',
  },
  {
    icon: Inbox,
    title: 'Hộp tin chưa phân loại',
    description: 'Tin không đọc được không bị mất: nằm chờ trong hộp tin để bạn ghi thành giao dịch, đánh dấu chuyển nội bộ hay bỏ qua.',
  },
  {
    icon: CreditCard,
    title: 'Theo dõi kỳ sao kê thẻ',
    description: 'Biết kỳ hiện tại còn bao nhiêu ngày, đã chi bao nhiêu, xem một thẻ hay gộp nhiều thẻ cùng lúc.',
  },
  {
    icon: Percent,
    title: 'Ước tính hoàn tiền',
    description: 'Khai báo % hoàn theo MCC, ngưỡng chi tối thiểu, bậc thang và trần mỗi kỳ — FinanceManager tính giúp bạn còn thiếu bao nhiêu.',
  },
  {
    icon: PieChart,
    title: 'Tổng quan & ngân sách',
    description: 'Thu, chi, dòng tiền ròng theo tháng, biểu đồ theo danh mục và cảnh báo khi sắp vượt ngân sách.',
  },
  {
    icon: Download,
    title: 'Dữ liệu là của bạn',
    description: 'Xuất CSV bất cứ lúc nào. Xoá tài khoản là xoá luôn toàn bộ giao dịch, thẻ và cài đặt.',
  },
]

export function LandingFeatures() {
  return (
    <section id="tinh-nang" className="scroll-mt-16 border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Một nơi cho tài khoản và thẻ tín dụng</h2>
          <p className="mt-3 text-muted-foreground">
            Thay cho file Excel ghi chép và việc mở từng app ngân hàng để cộng tay.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="heading-h3 mt-4">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
