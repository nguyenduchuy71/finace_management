import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAdminMutation } from '@/hooks/useAdmin'
import { ADMIN_REASON_LENGTH, type AdminMutation, type AdminUser } from '@/types/admin'
import type { ApiError } from '@/types/api'

const COPY: Record<AdminMutation, {
  title: string; effect: string; confirm: string; destructive: boolean
  /** Lỗi ban_failed: bước DB đã xong, bước GoTrue lỗi — nói đúng chiều. */
  banFailed?: string
}> = {
  suspend: {
    title: 'Khoá user',
    effect: 'User không đăng nhập được, phiên đang mở mất quyền xem dữ liệu ngay, Shortcut bị từ chối. Dữ liệu giữ nguyên.',
    confirm: 'Khoá',
    destructive: true,
    banFailed: 'Đã chặn dữ liệu và Shortcut, nhưng CHƯA chặn được đăng nhập. Bấm Khoá lại để hoàn tất.',
  },
  unsuspend: {
    title: 'Mở khoá user',
    effect: 'User đăng nhập và dùng Shortcut lại được như trước.',
    confirm: 'Mở khoá',
    destructive: false,
    banFailed: 'Đã mở lại dữ liệu và Shortcut, nhưng user VẪN chưa đăng nhập được. Bấm Mở khoá lại để hoàn tất.',
  },
  revoke_keys: {
    title: 'Thu hồi mọi API key',
    effect: 'Mọi Shortcut của user bị từ chối ngay. Thu hồi là vĩnh viễn; user tự tạo key mới nếu tài khoản không bị khoá.',
    confirm: 'Thu hồi',
    destructive: true,
  },
}

function ActionBody({ action, user, onDone, setBusy }: {
  action: AdminMutation
  user: AdminUser
  onDone: () => void
  setBusy: (b: boolean) => void
}) {
  const mutate = useAdminMutation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[action]
  const { min, max } = ADMIN_REASON_LENGTH
  const length = reason.trim().length
  const valid = length >= min && length <= max

  async function onConfirm() {
    if (!valid || mutate.isPending) return
    setError(null)
    setBusy(true)
    try {
      await mutate.mutateAsync({ action, userId: user.id, reason: reason.trim() })
      onDone()
    } catch (err) {
      const e = err as ApiError
      setError((e.code === 'ban_failed' && copy.banFailed) || e.message || 'Không thực hiện được. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}: {user.email ?? user.id}</DialogTitle>
        <DialogDescription>{copy.effect}</DialogDescription>
      </DialogHeader>
      <div className="space-y-1 text-sm">
        <label htmlFor="admin-reason" className="font-medium">Lý do (ghi vào nhật ký quản trị)</label>
        <textarea
          id="admin-reason" rows={3} value={reason} maxLength={max}
          aria-describedby="admin-reason-hint"
          onChange={(e) => { setReason(e.target.value); setError(null) }}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <p id="admin-reason-hint" className="text-xs text-muted-foreground">
          {min}–{max} ký tự. User không thấy lý do này.
        </p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutate.isPending}>Huỷ</Button>
        <Button
          type="button" variant={copy.destructive ? 'destructive' : 'default'}
          onClick={onConfirm} disabled={!valid || mutate.isPending}
        >
          {mutate.isPending ? 'Đang thực hiện…' : copy.confirm}
        </Button>
      </DialogFooter>
    </>
  )
}

export function AdminActionDialog({ action, user, onClose }: {
  action: AdminMutation | null
  user: AdminUser
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {action && <ActionBody key={action} action={action} user={user} setBusy={setBusy} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
