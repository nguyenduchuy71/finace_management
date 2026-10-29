import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAdminUser } from '@/hooks/useAdmin'
import { formatDisplayDateTime } from '@/utils/dates'
import { formatParseRate, suspensionState, type AdminMutation, type AdminUser } from '@/types/admin'
import { CreditLedgerList } from '@/features/credits/CreditLedgerList'
import { UNLIMITED_LABEL } from '@/types/credit'
import { AdminActionDialog } from './AdminActionDialog'
import { AdminCreditDialog } from './AdminCreditDialog'
import { SuspensionBadge } from './SuspensionBadge'

const when = (iso: string | null) => (iso ? formatDisplayDateTime(iso) : '—')

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  )
}

/** Chi tiết 1 user — CHỈ metadata. Mỗi lần mở ghi audit `view_user` ở server. */
function Detail({ userId }: { userId: string }) {
  const detail = useAdminUser(userId)
  const [action, setAction] = useState<AdminMutation | null>(null)
  const [adjusting, setAdjusting] = useState(false)

  if (detail.isPending) return <p className="text-sm text-muted-foreground">Đang tải…</p>
  if (detail.isError) return <p role="alert" className="text-sm text-destructive">{detail.error.message}</p>

  const { user, keys, ledger = [] } = detail.data
  const unparsed = Object.entries(user.unparsed30d)
  const suspended = user.suspendedAt !== null
  // Cùng logic với SuspensionBadge: 'mismatch' (ban lỗi giữa chừng) hiện cả hai nút để hoàn tất.
  const state = suspensionState(user, new Date().toISOString())
  const activeKeys = keys.filter((k) => k.revokedAt === null)

  return (
    <div className="space-y-4 text-sm">
      <dl className="divide-y">
        <Row label="Trạng thái"><SuspensionBadge user={user} /></Row>
        {suspended && <Row label="Lý do khoá">{user.suspendedReason ?? '—'}</Row>}
        <Row label="Đăng ký">{when(user.createdAt)}</Row>
        <Row label="Đăng nhập cuối">{when(user.lastSignInAt)}</Row>
        <Row label="Đồng ý chính sách">{when(user.consentAt)}</Row>
        <Row label="Giao dịch parser ghi (30 ngày)"><span className="money">{user.txCount30d}</span></Row>
        <Row label="Tin chưa ghi được (30 ngày)">
          {unparsed.length === 0 ? '0' : unparsed.map(([r, n]) => `${r}: ${n}`).join(', ')}
        </Row>
        <Row label="Tỉ lệ parse (30 ngày)">{formatParseRate(user.parseRate30d)}</Row>
        <Row label="Số dư credit">
          {user.creditUnlimited ? UNLIMITED_LABEL : <span className="money">{user.creditBalance}</span>}
        </Row>
      </dl>

      <div>
        <h3 className="mb-1 font-medium">Sổ cái credit (20 dòng gần nhất)</h3>
        <CreditLedgerList entries={ledger} />
      </div>

      <div>
        <h3 className="mb-1 font-medium">API key ({activeKeys.length} còn hiệu lực)</h3>
        {keys.length === 0 ? <p className="text-muted-foreground">Chưa có key.</p> : (
          <ul className="divide-y">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{k.name} <span className="font-mono text-xs text-muted-foreground">{k.prefix}…{k.last4}</span></span>
                <span className="text-xs text-muted-foreground">
                  {k.revokedAt ? 'Đã thu hồi' : k.lastUsedAt ? `Dùng ${when(k.lastUsedAt)}` : 'Chưa dùng'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {user.isAdmin ? (
        <p className="text-muted-foreground">Tài khoản quản trị — không thao tác được từ đây.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state !== 'active' && (
            <Button type="button" size="sm" variant="outline" onClick={() => setAction('unsuspend')}>Mở khoá</Button>
          )}
          {state !== 'suspended' && (
            <Button type="button" size="sm" variant="destructive" onClick={() => setAction('suspend')}>Khoá</Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setAction('revoke_keys')} disabled={activeKeys.length === 0}>
            Thu hồi mọi key
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAdjusting(true)}>Điều chỉnh credit</Button>
        </div>
      )}

      <AdminActionDialog action={action} user={user} onClose={() => setAction(null)} />
      <AdminCreditDialog open={adjusting} user={user} onClose={() => setAdjusting(false)} />
    </div>
  )
}

export function AdminUserDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-all">{user?.email ?? user?.id}</DialogTitle>
          <DialogDescription>Chỉ hiển thị thông tin vận hành — không có nội dung giao dịch.</DialogDescription>
        </DialogHeader>
        {user && <Detail key={user.id} userId={user.id} />}
      </DialogContent>
    </Dialog>
  )
}

