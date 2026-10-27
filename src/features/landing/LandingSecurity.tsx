import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

const POINTS = [
  {
    icon: LockKeyhole,
    title: 'Chỉ bạn thấy dữ liệu của mình',
    description: 'Mỗi dòng dữ liệu được khoá theo tài khoản ngay trong cơ sở dữ liệu (Row Level Security).',
  },
  {
    icon: KeyRound,
    title: 'Không cần mật khẩu ngân hàng',
    description: 'FinanceManager chỉ đọc nội dung thông báo bạn gửi tới, không kết nối hay đăng nhập vào ngân hàng.',
  },
  {
    icon: ShieldCheck,
    title: 'Không lưu mã OTP',
    description: 'Tin chứa mã OTP bị loại ngay khi nhận. API key chỉ lưu dạng băm SHA-256.',
  },
]

export function LandingSecurity() {
  return (
    <section id="bao-mat" className="scroll-mt-16 border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Dữ liệu tài chính cần được giữ kỹ</h2>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-4">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="heading-label text-base">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function LandingCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-3xl font-bold tracking-tight">Ngừng ghi chép bằng tay từ hôm nay</h2>
        <p className="mx-auto mt-3 max-w-xl opacity-90">
          Đăng ký bằng email trong một phút, không cần thẻ thanh toán.
        </p>
        <Button size="lg" variant="secondary" asChild className="mt-8">
          <Link to="/signup">Tạo tài khoản <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  )
}
