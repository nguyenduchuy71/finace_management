import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAdjustCredit } from '@/hooks/useAdmin'
import { useDialogBusyGuard } from '@/hooks/useDialogBusyGuard'
import { getErrorMessage } from '@/services/api-errors'
import { ADMIN_REASON_LENGTH, parseCreditDelta, type AdminUser } from '@/types/admin'

function Body({ user, setBusy, onDone }: { user: AdminUser; setBusy: (b: boolean) => void; onDone: () => void }) {
  const adjust = useAdjustCredit()
  const [deltaText, setDeltaText] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { min, max } = ADMIN_REASON_LENGTH
  const delta = parseCreditDelta(deltaText)
  const valid = delta !== null && reason.trim().length >= min && reason.trim().length <= max

  async function onConfirm() {
    if (!valid || adjust.isPending) return
    setError(null)
    setBusy(true)
    try {
      await adjust.mutateAsync({ userId: user.id, delta, reason: reason.trim() })
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Không điều chỉnh được. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Điều chỉnh credit: {user.email ?? user.id}</DialogTitle>
        <DialogDescription>
          Số dư hiện tại: {user.creditUnlimited ? 'Không giới hạn' : user.creditBalance}. Nhập số dương để cộng,
          số âm để trừ (không trừ quá số dư). Ghi vào nhật ký quản trị.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="credit-delta" className="font-medium">Số credit (+/−)</label>
          <Input
            id="credit-delta" inputMode="numeric" value={deltaText} placeholder="+50 hoặc -5"
            aria-invalid={deltaText !== '' && delta === null ? true : undefined}
            onChange={(e) => { setDeltaText(e.target.value); setError(null) }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="credit-reason" className="font-medium">Lý do</label>
          <Textarea
            id="credit-reason" rows={3} value={reason} maxLength={max}
            onChange={(e) => { setReason(e.target.value); setError(null) }}
          />
          <p className="text-xs text-muted-foreground">{min}–{max} ký tự. User không thấy lý do này.</p>
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={adjust.isPending}>Huỷ</Button>
        <Button type="button" onClick={onConfirm} disabled={!valid || adjust.isPending}>
          {adjust.isPending ? 'Đang thực hiện…' : 'Điều chỉnh'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function AdminCreditDialog({ open, user, onClose }: { open: boolean; user: AdminUser; onClose: () => void }) {
  const { setBusy, handleOpenChange } = useDialogBusyGuard((o) => { if (!o) onClose() })
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <Body user={user} setBusy={setBusy} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
