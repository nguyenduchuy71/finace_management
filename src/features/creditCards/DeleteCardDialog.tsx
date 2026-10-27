import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCardTransactionCount, useDeleteCreditCard } from '@/hooks/useCreditCardMutations'
import { useFilterStore } from '@/stores/filterStore'
import type { CreditCard } from '@/types/creditCard'
import { getErrorMessage } from '@/services/api-errors'

interface DeleteCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: CreditCard | null
}

/**
 * Xoá thẻ KÈM toàn bộ giao dịch của thẻ, không hoàn tác được. Vì vậy: nói rõ số giao
 * dịch sẽ mất (đếm mới lúc mở), và bắt gõ lại tên thẻ — một cú click nhầm không đủ.
 */
function DeleteBody({ card, onDone, setBusy }: {
  card: CreditCard
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const count = useCardTransactionCount(card.id)
  const del = useDeleteCreditCard()
  const setCardId = useFilterStore((s) => s.setCardId)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nameMatches = typed.trim() === card.cardName.trim()
  // Chưa biết số giao dịch thì chưa cho xoá: user chưa thấy mình đang mất gì.
  const canDelete = nameMatches && count.isSuccess && !del.isPending

  async function onConfirm() {
    if (del.isPending) return
    setError(null)
    setBusy(true)
    try {
      await del.mutateAsync(card.id)
      // Bỏ chọn thẻ vừa xoá; CreditCardSelector tự chọn thẻ đầu tiên còn lại.
      setCardId(null)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được thẻ. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Xoá thẻ “{card.cardName}”?</DialogTitle>
        <DialogDescription>
          Thao tác này không thể hoàn tác.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        {count.isPending && <p className="text-muted-foreground">Đang đếm giao dịch…</p>}
        {count.isError && (
          <p role="alert" className="text-destructive">
            Không đếm được số giao dịch của thẻ. Đóng hộp thoại và thử lại.
          </p>
        )}
        {count.isSuccess && (
          <p>
            Thẻ có <strong>{count.data}</strong> giao dịch. Tất cả sẽ bị xoá vĩnh viễn cùng thẻ.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="delete-confirm" className="font-medium">
            Gõ lại tên thẻ <span className="font-mono">{card.cardName}</span> để xác nhận
          </label>
          <Input
            id="delete-confirm" value={typed} autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={del.isPending}>Huỷ</Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={!canDelete}>
          {del.isPending ? 'Đang xoá…' : 'Xoá thẻ và giao dịch'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function DeleteCardDialog({ open, onOpenChange, card }: DeleteCardDialogProps) {
  // Đang xoá thì không cho đóng: user sẽ không thấy lỗi nếu lần xoá thất bại.
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open && card !== null}
      onOpenChange={(next) => { if (!busy) onOpenChange(next) }}
    >
      <DialogContent className="sm:max-w-md">
        {card && (
          <DeleteBody
            key={card.id} card={card} setBusy={setBusy}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
