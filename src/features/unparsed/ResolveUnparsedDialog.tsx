import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useFormBinding } from '@/components/form/useFormBinding'
import { FormField } from '@/components/form/FormField'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useAccounts } from '@/hooks/useAccounts'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useResolveUnparsed } from '@/hooks/useUnparsedMessages'
import {
  initialResolveForm, matchSourceByRef, validateResolveForm,
  type ResolveFormErrors, type ResolveFormInput,
} from '@/types/resolve-form'
import { RESOLVE_KIND_LABEL, TX_RESOLVE_KINDS, type UnparsedMessage } from '@/types/unparsed'
import type { BankAccount } from '@/types/account'
import type { CreditCard } from '@/types/creditCard'
import { suggestFromText } from '@/utils/unparsed-suggest'
import { getErrorMessage } from '@/services/api-errors'
import { useDialogBusyGuard } from '@/hooks/useDialogBusyGuard'

const KIND_HINT: Record<(typeof TX_RESOLVE_KINDS)[number], string> = {
  normal: 'Tính vào thu/chi trên tổng quan.',
  internal_transfer: 'Chuyển giữa TK/thẻ của bạn (kể cả trả nợ thẻ) — KHÔNG tính vào thu/chi.',
  cashback: 'Tiền hoàn từ ngân hàng — tính là thu.',
}
/** Thân form trong DialogContent: Radix huỷ khi đóng nên state tự reset mỗi lần mở. */
function ResolveBody({ message, accounts, cards, onDone, setBusy }: {
  message: UnparsedMessage
  accounts: BankAccount[]
  cards: CreditCard[]
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const resolve = useResolveUnparsed()
  const [suggestion] = useState(() => suggestFromText(message.rawText, message.receivedAt))
  const { form, errors, setErrors, submitError, setSubmitError, field } =
    useFormBinding<ResolveFormInput, ResolveFormErrors>(() =>
      initialResolveForm(suggestion, 'normal', matchSourceByRef(suggestion.ref, accounts, cards)))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (resolve.isPending) return
    const r = validateResolveForm(form)
    if (!r.ok) return setErrors(r.errors)
    setBusy(true)
    try {
      await resolve.mutateAsync({ messageId: message.id, kind: r.kind, tx: r.tx })
      onDone()
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Không ghi được giao dịch. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Ghi thành giao dịch</DialogTitle>
        <DialogDescription>
          Kiểm tra lại số tiền và thời điểm — đây là giá trị đoán từ thông báo. Ghi giao dịch thủ công tốn 1 credit.
        </DialogDescription>
      </DialogHeader>

      <p className="max-h-32 overflow-y-auto whitespace-pre-line rounded-md bg-muted p-3 text-xs">{message.rawText}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="resolve-kind" label="Loại" hint={KIND_HINT[form.kind]}>
          <NativeSelect {...field('kind', 'resolve-kind')}>
            {TX_RESOLVE_KINDS.map((k) => <option key={k} value={k}>{RESOLVE_KIND_LABEL[k]}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="resolve-source" label="Tài khoản / thẻ" error={errors.source}
          hint={accounts.length === 0 ? 'Chưa có tài khoản ngân hàng — thêm ở mục "Đã ghi nhận".' : undefined}>
          <NativeSelect {...field('source', 'resolve-source')}>
            <option value="">— Chọn —</option>
            <optgroup label="Tài khoản ngân hàng">
              {accounts.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.bankName} {a.accountNumber}</option>)}
            </optgroup>
            <optgroup label="Thẻ tín dụng">
              {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.bankName} {c.cardName} {c.cardNumber}</option>)}
            </optgroup>
          </NativeSelect>
        </FormField>
        <FormField id="resolve-direction" label="Chiều tiền" error={errors.direction}>
          <NativeSelect {...field('direction', 'resolve-direction')}>
            <option value="expense">Tiền ra (chi)</option>
            <option value="income">Tiền vào (thu)</option>
          </NativeSelect>
        </FormField>
        <FormField id="resolve-amount" label="Số tiền (đ)" error={errors.amount}>
          <Input {...field('amount', 'resolve-amount')} inputMode="numeric" placeholder="84.000" />
        </FormField>
        <FormField id="resolve-date" label="Thời điểm" error={errors.localDateTime}>
          <Input {...field('localDateTime', 'resolve-date')} type="datetime-local" />
        </FormField>
        <FormField id="resolve-desc" label="Mô tả" error={errors.description}>
          <Input {...field('description', 'resolve-desc')} placeholder="Chuyển khoản cho…" />
        </FormField>
      </div>

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={resolve.isPending}>Huỷ</Button>
        <Button type="submit" disabled={resolve.isPending}>
          {resolve.isPending ? 'Đang ghi…' : 'Ghi giao dịch'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Chờ danh sách TK + thẻ tải xong rồi mới dựng form: giá trị ban đầu (chọn sẵn nguồn
 * tiền theo đuôi số trong tin) chỉ tính MỘT lần lúc dựng.
 */
function ResolveLoader(props: { message: UnparsedMessage; onDone: () => void; setBusy: (b: boolean) => void }) {
  const accounts = useAccounts()
  const cards = useCreditCards()
  if (accounts.isError || cards.isError) {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <DialogTitle>Không tải được tài khoản / thẻ</DialogTitle>
        <Button variant="outline" onClick={() => { void accounts.refetch(); void cards.refetch() }}>Thử lại</Button>
      </div>
    )
  }
  if (!accounts.data || !cards.data) {
    return <DialogTitle className="text-sm font-normal text-muted-foreground">Đang tải tài khoản và thẻ…</DialogTitle>
  }
  return <ResolveBody {...props} accounts={accounts.data.data} cards={cards.data.data} />
}

export function ResolveUnparsedDialog({ message, onOpenChange }: {
  message: UnparsedMessage | null
  onOpenChange: (open: boolean) => void
}) {
  // Đang lưu thì không cho đóng: lỗi của lần lưu sẽ không còn chỗ hiển thị.
  const { setBusy, handleOpenChange } = useDialogBusyGuard(onOpenChange)
  return (
    <Dialog open={message !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {message && (
          <ResolveLoader key={message.id} message={message} setBusy={setBusy} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
