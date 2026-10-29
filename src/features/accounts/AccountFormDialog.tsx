import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useFormBinding } from '@/components/form/useFormBinding'
import { FormField } from '@/components/form/FormField'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useCreateAccount, useUpdateAccount } from '@/hooks/useAccountMutations'
import { useFilterStore } from '@/stores/filterStore'
import {
  EMPTY_ACCOUNT_FORM, accountToFormInput, validateAccountForm,
  type AccountFormErrors, type AccountFormInput,
} from '@/types/account-form'
import type { BankAccount } from '@/types/account'
import { KNOWN_BANK_NAMES, canonicalBankName } from '@/features/creditCards/bank-branding'
import { getErrorMessage } from '@/services/api-errors'
import { useDialogBusyGuard } from '@/hooks/useDialogBusyGuard'

const FIELD_ID: Record<keyof AccountFormInput, string> = {
  bankName: 'acc-bank',
  accountName: 'acc-name',
  accountNumber: 'acc-number',
  accountType: 'acc-type',
  balance: 'acc-balance',
}

/** Thân form trong DialogContent: Radix huỷ khi đóng nên state tự reset mỗi lần mở. */
function AccountFormBody({ account, onDone, setBusy }: {
  account: BankAccount | null
  onDone: () => void
  setBusy: (busy: boolean) => void
}) {
  const { form, errors, setErrors, submitError, setSubmitError, field } =
    useFormBinding<AccountFormInput, AccountFormErrors>(account ? accountToFormInput(account) : EMPTY_ACCOUNT_FORM)
  const setAccountId = useFilterStore((s) => s.setAccountId)

  const create = useCreateAccount()
  const update = useUpdateAccount(account)
  const pending = create.isPending || update.isPending

  // Tin MoMo không mang số TK: edge function gắn vào tài khoản MoMo duy nhất của user
  const isMoMo = canonicalBankName(form.bankName) === 'MoMo'
  const fieldProps = (key: keyof AccountFormInput) => field(key, FIELD_ID[key])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setSubmitError(null)
    // Edge function so khớp bank_name chính xác (phân biệt hoa thường).
    const result = validateAccountForm({ ...form, bankName: canonicalBankName(form.bankName) })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    setBusy(true)
    try {
      if (account) {
        await update.mutateAsync(result.values)
      } else {
        const created = await create.mutateAsync(result.values)
        setAccountId(created.id)
      }
      onDone()
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Không lưu được tài khoản. Vui lòng thử lại.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{account ? 'Sửa tài khoản' : 'Thêm tài khoản ngân hàng'}</DialogTitle>
        <DialogDescription>
          Số tài khoản phải khớp 4 ký tự cuối trong thông báo ngân hàng để giao dịch tự động gắn đúng tài khoản.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="acc-bank" label="Ngân hàng" error={errors.bankName}
          hint="Chọn tên trong gợi ý để giao dịch tự động gắn đúng tài khoản">
          <Input {...fieldProps('bankName')} list="acc-bank-options" placeholder="Vietinbank" />
          <datalist id="acc-bank-options">
            {KNOWN_BANK_NAMES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </FormField>
        <FormField id="acc-name" label="Tên tài khoản" error={errors.accountName}>
          <Input {...fieldProps('accountName')} placeholder="TK lương" />
        </FormField>
        <FormField id="acc-number" label="Số tài khoản" error={errors.accountNumber}
          hint={isMoMo
            ? 'Tin MoMo không có số tài khoản nên ký tự nào cũng được, ví dụ 4 số cuối điện thoại: ****0123. Chỉ nên có MỘT tài khoản MoMo'
            : '4 dấu * + 4 ký tự cuối, ví dụ ****4982'}>
          <Input {...fieldProps('accountNumber')} placeholder="****4982" />
        </FormField>
        <FormField id="acc-type" label="Loại tài khoản" error={errors.accountType}>
          <NativeSelect {...fieldProps('accountType')}>
            <option value="checking">Thanh toán</option>
            <option value="savings">Tiết kiệm</option>
          </NativeSelect>
        </FormField>
        <FormField id="acc-balance" label="Số dư (đ)" error={errors.balance}
          hint="Chỉ để tham khảo, không tự cập nhật. Có thể để trống">
          <Input {...fieldProps('balance')} inputMode="numeric" placeholder="5.000.000" />
        </FormField>
      </div>

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Huỷ</Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : account ? 'Lưu thay đổi' : 'Thêm tài khoản'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AccountFormDialog({ open, onOpenChange, account = null }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có tài khoản = sửa, không có = thêm mới. */
  account?: BankAccount | null
}) {
  const { setBusy, handleOpenChange } = useDialogBusyGuard(onOpenChange)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <AccountFormBody
          key={account?.id ?? 'new'} account={account} setBusy={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
