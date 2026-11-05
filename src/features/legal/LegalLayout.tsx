import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, BrandMark } from '@/components/layout/BrandMark'
import { legalConfig, LEGAL_PLACEHOLDER } from '@/config/legal-config'
import { PRIVACY_POLICY_VERSION } from '@/types/api-key'

/** Giá trị cấu hình pháp lý; còn trống thì hiện marker nổi bật để không ai công bố nhầm. */
export function LegalValue({ value }: { value: string }) {
  if (value !== LEGAL_PLACEHOLDER) return <strong>{value}</strong>
  return <mark className="rounded bg-warning/30 px-1 font-semibold text-foreground">{LEGAL_PLACEHOLDER}</mark>
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="heading-h3">{title}</h2>
      {children}
    </section>
  )
}

/** Khung chung hai trang pháp lý: tiêu đề, phiên bản, lưu ý chưa qua luật sư, điều hướng chéo. */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="Về trang chủ"><BrandMark /></Link>
          <nav className="flex gap-4 text-sm" aria-label="Trang pháp lý">
            <Link to="/privacy" className="hover:underline">Chính sách bảo mật</Link>
            <Link to="/terms" className="hover:underline">Điều khoản sử dụng</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed">
        <div className="space-y-1">
          <h1 className="heading-display text-2xl">{title}</h1>
          <p className="text-muted-foreground">
            {APP_NAME} · Phiên bản <span className="money">{PRIVACY_POLICY_VERSION}</span>
          </p>
        </div>
        <p role="note" className="rounded-lg border bg-muted/50 p-3 text-muted-foreground">
          Văn bản này do đơn vị vận hành tự soạn dựa trên Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân
          (hiệu lực 01/01/2026), chưa qua rà soát của luật sư và có thể được điều chỉnh. Khi có thay đổi quan trọng,
          phiên bản ở trên sẽ được cập nhật.
        </p>
        {children}
        <p className="border-t pt-4 text-muted-foreground">
          Đơn vị vận hành: <LegalValue value={legalConfig.operatorName} />
          {' · '}Liên hệ: <LegalValue value={legalConfig.contactEmail} />
        </p>
      </main>
    </div>
  )
}
