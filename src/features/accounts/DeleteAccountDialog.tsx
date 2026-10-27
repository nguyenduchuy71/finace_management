import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAccountTransactionCount, useDeleteAccount } from '@/hooks/useAccountMutations'
import { useFilterStore } from '@/stores/filterStore'
import type { BankAccount } from '@/types/account'
import { getErrorMessage } from '@/services/api-errors'

/**
 * Xoá TK KÈM toàn bộ giao dịch, không hoàn tác được: nói rõ số giao dịch sẽ mất (đếm
 * mới lúc mở) và bắt gõ lại tên TK — giống DeleteCardDialog.
 */
function DeleteBody({ account, onDone, setBusy }: {
  account: BankAccount
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const count = useAccountTransactionCount(account.id)
  const del = useDeleteAccount()
  const setAccountId = useFilterStore((s) => s.setAccountId)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canDelete = typed.trim() === account.accountName.trim() && count.isSuccess && !del.isPending

  async function onConfirm() {
    if (del.isPending) return
    setError(null)
    setBusy(true)
    try {
      await del.mutateAsync(account.id)
      setAccountId(null) // AccountTabs tự chọn TK đầu tiên còn lại
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được tài khoản. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Xoá tài khoản “{account.accountName}”?</DialogTitle>
        <DialogDescription>Thao tác này không thể hoàn tác.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        {count.isPending && <p className="text-muted-foreground">Đang đếm giao dịch…</p>}
        {count.isError && (
          <p role="alert" className="text-destructive">
            Không đếm được số giao dịch của tài khoản. Đóng hộp thoại và thử lại.
          </p>
        )}
        {count.isSuccess && (
          <p>Tài khoản có <strong>{count.data}</strong> giao dịch. Tất cả sẽ bị xoá vĩnh viễn cùng tài khoản.</p>
        )}
        <div className="space-y-1">
          <label htmlFor="delete-acc-confirm" className="font-medium">
            Gõ lại tên tài khoản <span className="font-mono">{account.accountName}</span> để xác nhận
          </label>
          <Input id="delete-acc-confirm" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={del.isPending}>Huỷ</Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={!canDelete}>
          {del.isPending ? 'Đang xoá…' : 'Xoá tài khoản và giao dịch'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function DeleteAccountDialog({ open, onOpenChange, account }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: BankAccount | null
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open && account !== null} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        {account && (
          <DeleteBody key={account.id} account={account} setBusy={setBusy} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
