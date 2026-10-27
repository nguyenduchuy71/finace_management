import { Navigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsAdmin } from '@/hooks/useAdmin'
import { MfaGate } from '@/features/auth/MfaGate'
import { AdminUsersList } from '@/features/admin/AdminUsersList'
import { AdminAuditList } from '@/features/admin/AdminAuditList'

/**
 * Trang quản trị (lazy chunk). Ẩn với user thường chỉ là tiện lợi: function `admin` tự kiểm
 * role + aal2 cho mọi lời gọi.
 */
export default function AdminPage() {
  if (!useIsAdmin()) return <Navigate to="/accounts" replace />

  return (
    <div className="space-y-4">
      <PageHeader icon={ShieldCheck} title="Quản trị" description="Khoá user, thu hồi key, nhật ký thao tác — không xem nội dung giao dịch" />
      <MfaGate>
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" className="min-h-[44px]">User</TabsTrigger>
            <TabsTrigger value="audit" className="min-h-[44px]">Nhật ký</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4"><AdminUsersList /></TabsContent>
          <TabsContent value="audit" className="mt-4"><AdminAuditList /></TabsContent>
        </Tabs>
      </MfaGate>
    </div>
  )
}
