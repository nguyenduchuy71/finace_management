import { z } from 'zod'
import type { BankAccount } from './account'
import { CARD_NUMBER_PATTERN } from './credit-card-form'
import { moneyAmountField } from './form-fields'

/**
 * Cùng quy tắc mask với số thẻ (xem CARD_NUMBER_PATTERN): edge function resolve TK bằng
 * `account_number LIKE '%<account_ref>'`, nên số TK phải đúng dạng `****` + 4 ký tự cuối như
 * trong thông báo. DB có check constraint cùng pattern.
 */
export const AccountFormSchema = z.object({
  bankName: z.string().trim().min(1, 'Nhập tên ngân hàng'),
  accountName: z.string().trim().min(1, 'Nhập tên tài khoản'),
  accountNumber: z.string().trim().regex(
    CARD_NUMBER_PATTERN,
    'Nhập dạng ****4982: 4 dấu * và 4 ký tự cuối đúng như trong thông báo ngân hàng'
  ),
  accountType: z.enum(['checking', 'savings']),
  // Không tự cập nhật từ thông báo — chỉ để tham khảo. Để trống = 0.
  balance: moneyAmountField('Số dư'),
})

export type AccountFormInput = z.input<typeof AccountFormSchema>
export type AccountFormValues = z.output<typeof AccountFormSchema>
export type AccountFormErrors = Partial<Record<keyof AccountFormInput, string>>

export const EMPTY_ACCOUNT_FORM: AccountFormInput = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  accountType: 'checking',
  balance: '',
}

export function accountToFormInput(a: BankAccount): AccountFormInput {
  return {
    bankName: a.bankName,
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    accountType: a.accountType,
    balance: String(a.balance),
  }
}

/** Validate form; lỗi đầu tiên của mỗi ô để hiện ngay dưới ô đó. */
export function validateAccountForm(
  input: AccountFormInput
): { ok: true; values: AccountFormValues } | { ok: false; errors: AccountFormErrors } {
  const result = AccountFormSchema.safeParse(input)
  if (result.success) return { ok: true, values: result.data }
  const errors: AccountFormErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof AccountFormInput
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
