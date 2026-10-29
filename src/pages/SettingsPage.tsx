import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreditSection } from '@/features/credits/CreditSection'
import { ApiKeysSection } from '@/features/settings/ApiKeysSection'
import { OwnerNamesSection } from '@/features/settings/OwnerNamesSection'
import { DeleteAccountSection } from '@/features/settings/DeleteAccountSection'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Cài đặt" description="Credit, API key cho Shortcut, nhận diện chuyển nội bộ, tài khoản" />
      <CreditSection />
      <ApiKeysSection />
      <OwnerNamesSection />
      <DeleteAccountSection />
    </div>
  )
}
