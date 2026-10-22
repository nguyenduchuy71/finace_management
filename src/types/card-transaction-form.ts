import { z } from 'zod'
import { moneyAmountField } from './form-fields'
import { TransactionKindSchema } from './account'
import type { Category } from './categories'
import type { CreditCardTransaction } from './creditCard'
import type { CardTransactionPatch } from '@/services/creditCards'
import { CATEGORY_TAXONOMY } from '@/utils/categories'
import { toVnLocalInput } from '@/utils/dates'
import { vnLocalToISO } from '@/utils/unparsed-suggest'

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_TAXONOMY) as Category[]

/** Form "Sửa giao dịch thẻ": mọi ô là chuỗi như trong input; '' = trống. */
export const CardTxFormSchema = z.object({
  merchantName: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  description: z.string().trim().max(300, 'Tối đa 300 ký tự'),
  kind: TransactionKindSchema,
  direction: z.enum(['income', 'expense']),
  amount: moneyAmountField('Số tiền').refine((n) => n > 0, 'Nhập số tiền lớn hơn 0'),
  localDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Chọn ngày giờ giao dịch'),
  category: z.union([z.literal(''), z.enum(CATEGORY_OPTIONS as [Category, ...Category[]])]),
  mcc: z.string().regex(/^(\d{4})?$/, 'MCC phải gồm 4 chữ số'),
}).refine((v) => v.kind !== 'cashback' || v.direction === 'income', {
  // Cashback âm sẽ trừ vào thu trên tổng quan — gần như chắc chắn là chọn nhầm chiều.
  path: ['direction'], message: 'Cashback là tiền vào — chọn "Tiền vào thẻ"',
})

export type CardTxFormInput = z.input<typeof CardTxFormSchema>
export type CardTxFormErrors = Partial<Record<keyof CardTxFormInput, string>>

export function initialCardTxForm(tx: CreditCardTransaction): CardTxFormInput {
  return {
    merchantName: tx.merchantName,
    description: tx.description,
    kind: tx.kind ?? 'normal',
    direction: tx.amount > 0 ? 'income' : 'expense',
    amount: String(Math.abs(tx.amount)),
    localDateTime: toVnLocalInput(tx.transactionDate),
    category: (tx.category as Category | undefined) ?? '',
    mcc: tx.mcc ?? '',
  }
}

/**
 * Validate rồi chỉ giữ trường user THỰC SỰ đổi so với `initial` — không ghi lại giá trị cũ (thời điểm
 * mất giây, merchant suy từ mô tả khi `merchant_name` trống…). Patch rỗng = không có gì để lưu.
 */
export function toCardTxPatch(
  input: CardTxFormInput, initial: CardTxFormInput,
): { ok: true; patch: CardTransactionPatch } | { ok: false; errors: CardTxFormErrors } {
  const r = CardTxFormSchema.safeParse(input)
  if (!r.success) {
    const errors: CardTxFormErrors = {}
    for (const issue of r.error.issues) {
      const key = issue.path[0] as keyof CardTxFormInput
      if (!errors[key]) errors[key] = issue.message
    }
    return { ok: false, errors }
  }
  const v = r.data
  const changed = (k: keyof CardTxFormInput) => input[k].trim() !== initial[k].trim()
  const patch: CardTransactionPatch = {}
  if (changed('merchantName')) patch.merchantName = v.merchantName || null
  if (changed('description')) patch.description = v.description || null
  if (changed('kind')) patch.kind = v.kind
  // Đổi chiều hoặc số tiền đều phải ghi lại số tiền có dấu.
  if (changed('amount') || changed('direction')) patch.amount = v.direction === 'income' ? v.amount : -v.amount
  if (changed('localDateTime')) patch.transactionDate = vnLocalToISO(v.localDateTime)
  if (changed('category')) patch.category = v.category || null
  if (changed('mcc')) patch.mcc = v.mcc || null
  return { ok: true, patch }
}
