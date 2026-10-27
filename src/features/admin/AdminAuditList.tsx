import { Card } from '@/components/ui/card'
import { useAdminAudit, useAdminUsers } from '@/hooks/useAdmin'
import { formatDisplayDateTime } from '@/utils/dates'
import { AUDIT_ACTION_LABEL } from '@/types/admin'

/**
 * Nhật ký quản trị (200 dòng mới nhất). Email ghép từ danh sách user đã tải — audit chỉ lưu id;
 * user đã bị xoá hiện id rút gọn.
 */
export function AdminAuditList() {
  const audit = useAdminAudit()
  const users = useAdminUsers()
  const emailOf = (id: string | null) => {
    if (!id) return '—'
    return users.data?.find((u) => u.id === id)?.email ?? `${id.slice(0, 8)}… (đã xoá)`
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Nhật ký quản trị</h2>
      <div className="mt-4">
        {audit.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {audit.isError && <p role="alert" className="text-sm text-destructive">{audit.error.message}</p>}
        {audit.isSuccess && audit.data.length === 0 && <p className="text-sm text-muted-foreground">Chưa có thao tác nào.</p>}
        {audit.isSuccess && audit.data.length > 0 && (
          <ul className="divide-y text-sm">
            {audit.data.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="font-medium">{AUDIT_ACTION_LABEL[e.action]}</span> · {emailOf(e.target_user_id)}</span>
                  <span className="text-xs text-muted-foreground">{formatDisplayDateTime(e.created_at)}</span>
                </div>
                <p className="text-muted-foreground">
                  {e.reason}
                  {e.action === 'revoke_keys' && typeof e.payload.revoked === 'number' && ` (${e.payload.revoked} key)`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
