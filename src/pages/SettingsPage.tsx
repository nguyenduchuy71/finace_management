import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreditSection } from '@/features/credits/CreditSection'
import { PaymentSection } from '@/features/credits/PaymentSection'
import { ApiKeysSection } from '@/features/settings/ApiKeysSection'
import { OwnerNamesSection } from '@/features/settings/OwnerNamesSection'
import { DeleteAccountSection } from '@/features/settings/DeleteAccountSection'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Cài đặt" description="Credit, API key cho Shortcut, nhận diện chuyển nội bộ, tài khoản" />
      <CreditSection />
      <PaymentSection />
      <ApiKeysSection />
      <OwnerNamesSection />
      <DeleteAccountSection />
      <p className="text-center text-xs text-muted-foreground">
        <Link to="/privacy" className="underline">Chính sách bảo mật</Link>
        {' · '}
        <Link to="/terms" className="underline">Điều khoản sử dụng</Link>
      </p>
    </div>
  )
}
