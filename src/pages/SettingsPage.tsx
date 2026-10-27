import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ApiKeysSection } from '@/features/settings/ApiKeysSection'
import { OwnerNamesSection } from '@/features/settings/OwnerNamesSection'
import { DeleteAccountSection } from '@/features/settings/DeleteAccountSection'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Cài đặt" description="API key cho Shortcut, nhận diện chuyển nội bộ, tài khoản" />
      <ApiKeysSection />
      <OwnerNamesSection />
      <DeleteAccountSection />
    </div>
  )
}
