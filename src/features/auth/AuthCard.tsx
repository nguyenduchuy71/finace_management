import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { APP_NAME } from '@/components/layout/BrandMark'

/** Khung chung của các trang xác thực công khai: logo (về trang chủ) + tiêu đề + nội dung. */
export function AuthCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm gap-0 p-6">
        <Link to="/" className="mb-6 flex w-fit items-center gap-2" aria-label="Về trang chủ">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="heading-h3 tracking-tight">{APP_NAME}</span>
        </Link>
        {title && <h1 className="heading-h2 mb-4">{title}</h1>}
        {children}
      </Card>
    </div>
  )
}
