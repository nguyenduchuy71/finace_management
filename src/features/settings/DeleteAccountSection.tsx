import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useDeleteMyAccount } from '@/hooks/useUserSettings'
import type { ApiError } from '@/types/api'

/** Gõ lại email mới cho xoá — cùng kiểu xác nhận với DeleteAccountDialog (TK ngân hàng). */
function DeleteBody({ email, onDone, setBusy }: {
  email: string
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const del = useDeleteMyAccount()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canDelete = typed.trim().toLowerCase() === email.toLowerCase() && !del.isPending

  async function onConfirm() {
    if (!canDelete) return
    setError(null)
    setBusy(true)
    try {
      await del.mutateAsync()
      // Thành công: phiên bị đăng xuất, ProtectedRoute đưa về /login — không cần đóng dialog.
    } catch (err) {
      setError((err as ApiError).message ?? 'Không xoá được tài khoản. Vui lòng thử lại.')
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Xoá vĩnh viễn tài khoản?</DialogTitle>
        <DialogDescription>Thao tác này không thể hoàn tác.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <p>
          Toàn bộ giao dịch, tài khoản ngân hàng, thẻ, rule hoàn tiền, hộp tin và API key sẽ bị xoá.
          Shortcut đang gửi tin sẽ bị từ chối. Muốn giữ dữ liệu, hãy xuất CSV trước.
        </p>
        <div className="space-y-1">
          <label htmlFor="delete-me-confirm" className="font-medium">
            Gõ lại email <span className="font-mono">{email}</span> để xác nhận
          </label>
          <Input id="delete-me-confirm" type="email" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={del.isPending}>Huỷ</Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={!canDelete}>
          {del.isPending ? 'Đang xoá…' : 'Xoá tài khoản'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function DeleteAccountSection() {
  const { session } = useAuth()
  const email = session?.user.email ?? ''
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <Card className="border-destructive/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h2 className="font-semibold">Xoá tài khoản</h2>
            <p className="body-sm text-muted-foreground">Xoá vĩnh viễn tài khoản và mọi dữ liệu của bạn.</p>
          </div>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={!email}>
          Xoá tài khoản
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          {open && <DeleteBody email={email} setBusy={setBusy} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
