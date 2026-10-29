import { SUPPORTED_BANKS } from '@/config/supported-banks'

const STEPS = [
  { title: 'Tạo tài khoản', description: 'Đăng ký bằng email, thêm tài khoản ngân hàng và thẻ tín dụng (chỉ 4 số cuối).' },
  { title: 'Lấy API key', description: 'Tạo key riêng trong trang Cài đặt. Key chỉ hiện một lần và thu hồi được bất cứ lúc nào.' },
  { title: 'Cài iOS Shortcut', description: 'Shortcut chạy khi có thông báo ngân hàng và gửi nội dung về FinanceManager. Từ đó mọi thứ tự động.' },
]

export function LandingHowItWorks() {
  return (
    <section id="cach-hoat-dong" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Bắt đầu trong 3 bước</h2>
          <p className="mt-3 text-muted-foreground">Cài đặt một lần, khoảng 5 phút.</p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6">
              <span className="heading-display text-primary">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="heading-h3 mt-4">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 text-center">
          <p className="heading-label text-muted-foreground">Đọc được thông báo của</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Ngân hàng được hỗ trợ">
            {SUPPORTED_BANKS.map((bank) => (
              <li key={bank} className="rounded-full border bg-card px-3 py-1 text-sm">{bank}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
