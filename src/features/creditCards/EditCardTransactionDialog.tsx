import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useUpdateCardTransaction } from '@/hooks/useUpdateCardTransaction'
import {
  CATEGORY_OPTIONS, initialCardTxForm, toCardTxPatch,
  type CardTxFormErrors, type CardTxFormInput,
} from '@/types/card-transaction-form'
import { RESOLVE_KIND_LABEL, TX_RESOLVE_KINDS } from '@/types/unparsed'
import type { ApiError } from '@/types/api'
import type { CreditCardTransaction } from '@/types/creditCard'
import { MccPicker } from './MccPicker'

const KIND_HINT: Record<(typeof TX_RESOLVE_KINDS)[number], string> = {
  normal: 'Tính vào thu/chi trên tổng quan.',
  internal_transfer: 'Trả nợ thẻ / chuyển giữa TK của bạn — KHÔNG tính vào thu/chi.',
  cashback: 'Tiền hoàn từ ngân hàng — tính là thu.',
}

type TextField = Exclude<keyof CardTxFormInput, 'mcc'>

/** Thân form trong DialogContent: Radix gỡ khi đóng nên state tự reset mỗi lần mở. */
function EditBody({ tx, onDone, setBusy }: {
  tx: CreditCardTransaction
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const update = useUpdateCardTransaction()
  const [initial] = useState(() => initialCardTxForm(tx))
  const [form, setForm] = useState<CardTxFormInput>(initial)
  const [errors, setErrors] = useState<CardTxFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = (key: keyof CardTxFormInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
  }
  const field = (key: TextField, id: string) => ({
    id,
    value: form[key],
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': describedBy(id, Boolean(errors[key])),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value),
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (update.isPending) return
    const r = toCardTxPatch(form, initial)
    if (!r.ok) return setErrors(r.errors)
    if (Object.keys(r.patch).length === 0) return onDone()
    setBusy(true)
    try {
      await update.mutateAsync({ txId: tx.id, patch: r.patch })
      onDone()
    } catch (err) {
      setSubmitError((err as ApiError).message ?? 'Không lưu được giao dịch. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Sửa giao dịch</DialogTitle>
        <DialogDescription>Sửa lại thông tin đọc sai từ thông báo ngân hàng.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="edit-tx-merchant" label="Nơi giao dịch" error={errors.merchantName}>
          <Input {...field('merchantName', 'edit-tx-merchant')} placeholder="WINMART HCM" />
        </FormField>
        <FormField id="edit-tx-desc" label="Mô tả" error={errors.description}>
          <Input {...field('description', 'edit-tx-desc')} />
        </FormField>
        <FormField id="edit-tx-direction" label="Chiều tiền" error={errors.direction}>
          <NativeSelect {...field('direction', 'edit-tx-direction')}>
            <option value="expense">Chi tiêu (tiền ra)</option>
            <option value="income">Tiền vào thẻ (trả nợ, hoàn tiền)</option>
          </NativeSelect>
        </FormField>
        <FormField id="edit-tx-amount" label="Số tiền (đ)" error={errors.amount}>
          <Input {...field('amount', 'edit-tx-amount')} inputMode="numeric" />
        </FormField>
        <FormField id="edit-tx-date" label="Thời điểm" error={errors.localDateTime}>
          <Input {...field('localDateTime', 'edit-tx-date')} type="datetime-local" />
        </FormField>
        <FormField id="edit-tx-kind" label="Loại" hint={KIND_HINT[form.kind]}>
          <NativeSelect {...field('kind', 'edit-tx-kind')}>
            {TX_RESOLVE_KINDS.map((k) => <option key={k} value={k}>{RESOLVE_KIND_LABEL[k]}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="edit-tx-category" label="Danh mục" error={errors.category}>
          <NativeSelect {...field('category', 'edit-tx-category')}>
            <option value="">Chưa phân loại</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="edit-tx-mcc" label="MCC" error={errors.mcc} hint="Dùng để tính hoàn tiền theo rule của thẻ">
          <MccPicker
            id="edit-tx-mcc"
            value={form.mcc}
            noneLabel="Chưa phân loại MCC"
            onChange={(code) => set('mcc', code)}
            aria-invalid={errors.mcc ? true : undefined}
            aria-describedby={describedBy('edit-tx-mcc', Boolean(errors.mcc))}
            className="h-9 w-full text-sm"
          />
        </FormField>
      </div>

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>Huỷ</Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditCardTransactionDialog({ transaction, onOpenChange }: {
  /** Giao dịch đang sửa; null = đóng. */
  transaction: CreditCardTransaction | null
  onOpenChange: (open: boolean) => void
}) {
  // Đang lưu thì không cho đóng: lỗi của lần lưu sẽ không còn chỗ hiển thị.
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={transaction !== null} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-xl">
        {transaction && (
          <EditBody key={transaction.id} tx={transaction} setBusy={setBusy} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
