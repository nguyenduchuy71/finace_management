import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useCreateCreditCard, useUpdateCreditCard } from '@/hooks/useCreditCardMutations'
import { useFilterStore } from '@/stores/filterStore'
import {
  EMPTY_CARD_FORM, cardToFormInput, validateCardForm,
  type CardFormErrors, type CardFormInput,
} from '@/types/credit-card-form'
import type { ApiError } from '@/types/api'
import type { CreditCard } from '@/types/creditCard'
import { CARD_TYPE_LABEL, KNOWN_BANK_NAMES, canonicalBankName } from './bank-branding'

interface CardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có thẻ = sửa, không có = thêm mới. */
  card?: CreditCard | null
}

const FIELD_ID: Record<keyof CardFormInput, string> = {
  bankName: 'card-bank',
  cardName: 'card-name',
  cardNumber: 'card-number',
  cardType: 'card-type',
  statementDate: 'card-statement',
  paymentDueDate: 'card-due',
  creditLimit: 'card-limit',
}

/**
 * Thân form nằm TRONG DialogContent: Radix huỷ nội dung khi đóng nên state tự reset
 * mỗi lần mở, không cần useEffect đồng bộ props -> state (tránh cascading render).
 */
function CardFormBody({ card, onDone, setBusy }: {
  card: CreditCard | null
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const [form, setForm] = useState<CardFormInput>(card ? cardToFormInput(card) : EMPTY_CARD_FORM)
  const [errors, setErrors] = useState<CardFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const setCardId = useFilterStore((s) => s.setCardId)

  const create = useCreateCreditCard()
  const update = useUpdateCreditCard(card)
  const pending = create.isPending || update.isPending

  /** Props chung của mỗi ô: giá trị, sửa là xoá lỗi của ô đó, và nối lỗi vào ô cho trình đọc màn hình. */
  const fieldProps = (key: keyof CardFormInput) => ({
    id: FIELD_ID[key],
    value: form[key],
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': describedBy(FIELD_ID[key], Boolean(errors[key])),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
      setSubmitError(null)
    },
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return // chặn Enter bấm lặp trong lúc đang lưu
    setSubmitError(null)
    // Chuẩn hoá hoa/thường tên ngân hàng trước khi validate: edge function so khớp chính xác.
    const result = validateCardForm({ ...form, bankName: canonicalBankName(form.bankName) })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    setBusy(true)
    try {
      if (card) {
        await update.mutateAsync(result.values)
      } else {
        const created = await create.mutateAsync(result.values)
        setCardId(created.id) // chuyển sang thẻ vừa thêm để user thấy ngay
      }
      onDone()
    } catch (err) {
      const apiErr = err as ApiError
      setSubmitError(
        apiErr.code === '23505'
          ? 'Thẻ này đã tồn tại (cùng ngân hàng và số thẻ).'
          : apiErr.message ?? 'Không lưu được thẻ. Vui lòng thử lại.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{card ? 'Sửa thẻ tín dụng' : 'Thêm thẻ tín dụng'}</DialogTitle>
        <DialogDescription>
          Số thẻ phải khớp với 4 ký tự cuối trong tin nhắn ngân hàng để giao dịch tự động gắn đúng thẻ.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="card-bank" label="Ngân hàng" error={errors.bankName}
          hint="Chọn tên trong gợi ý để giao dịch tự động gắn đúng thẻ"
        >
          <Input {...fieldProps('bankName')} list="card-bank-options" placeholder="VPBank" />
          <datalist id="card-bank-options">
            {KNOWN_BANK_NAMES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </FormField>
        <FormField id="card-name" label="Tên thẻ" error={errors.cardName}>
          <Input {...fieldProps('cardName')} placeholder="VPBank Mobifone" />
        </FormField>
        <FormField
          id="card-number" label="Số thẻ" error={errors.cardNumber}
          hint="4 dấu * + 4 ký tự cuối đúng như trong SMS, ví dụ ****x265"
        >
          <Input {...fieldProps('cardNumber')} placeholder="****x265" />
        </FormField>
        <FormField id="card-type" label="Loại thẻ" error={errors.cardType}>
          <NativeSelect {...fieldProps('cardType')}>
            {Object.entries(CARD_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="card-statement" label="Ngày sao kê (1-31)" error={errors.statementDate}>
          <Input {...fieldProps('statementDate')} inputMode="numeric" />
        </FormField>
        <FormField id="card-due" label="Ngày đến hạn (1-31)" error={errors.paymentDueDate}>
          <Input {...fieldProps('paymentDueDate')} inputMode="numeric" />
        </FormField>
        <FormField
          id="card-limit" label="Hạn mức (đ)" error={errors.creditLimit}
          hint="Có thể để trống (tính là 0)"
        >
          <Input {...fieldProps('creditLimit')} inputMode="numeric" placeholder="50.000.000" />
        </FormField>
      </div>

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Huỷ</Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : card ? 'Lưu thay đổi' : 'Thêm thẻ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CardFormDialog({ open, onOpenChange, card = null }: CardFormDialogProps) {
  // Đang lưu thì không cho đóng (Esc / click ra ngoài / nút X): đóng giữa chừng làm
  // lỗi của lần lưu không còn chỗ hiển thị, user tưởng đã lưu.
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-xl">
        <CardFormBody
          key={card?.id ?? 'new'} card={card} setBusy={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
