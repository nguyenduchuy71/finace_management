import { z } from 'zod'
import type { CreditCard } from './creditCard'

/**
 * `card_number` phải là ĐÚNG MỘT định dạng mask: 4 dấu `*` + 4 ký tự cuối của thẻ.
 *
 * Edge function resolve thẻ bằng `card_number LIKE '%<account_ref>'` (account_ref là
 * 4 KÝ TỰ cuối trong SMS, có thể là chữ như `x265`, thậm chí có `%` như `9%08` — nó đã
 * escape wildcard). Sai định dạng thì giao dịch không gắn được vào thẻ: không hiện trong
 * danh sách nhưng dashboard vẫn đếm. Unique ở DB chỉ chặn trùng chính xác, nên `****5678`
 * và `5678` vẫn cùng khớp một LIKE — tiền tố `****` bắt buộc là thứ chống nhập nhằng đó.
 * Đuôi 4 ký tự để mở (trừ khoảng trắng và `*`) vì bank mask kiểu nào cũng có.
 */
export const CARD_NUMBER_PATTERN = /^\*{4}[^\s*]{4}$/

const dayField = (label: string) =>
  z.string().trim()
    .regex(/^\d{1,2}$/, `${label} từ 1 đến 31`)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 31, `${label} từ 1 đến 31`)

/** Input là chuỗi (đúng như ô nhập), output là số đã chuẩn hoá để gửi lên DB. */
export const CardFormSchema = z.object({
  bankName: z.string().trim().min(1, 'Nhập tên ngân hàng'),
  cardName: z.string().trim().min(1, 'Nhập tên thẻ'),
  cardNumber: z.string().trim().regex(
    CARD_NUMBER_PATTERN,
    'Nhập dạng ****x265: 4 dấu * và 4 ký tự cuối đúng như trong SMS ngân hàng'
  ),
  cardType: z.enum(['visa', 'mastercard', 'jcb', 'amex']),
  statementDate: dayField('Ngày sao kê'),
  paymentDueDate: dayField('Ngày đến hạn'),
  // Để trống = 0 (SMS ngân hàng không có hạn mức, DB mặc định 0). Chỉ nhận số thuần hoặc
  // nhóm nghìn đúng chuẩn: "1.5" / "1,5" trước đây âm thầm thành 15đ.
  creditLimit: z.string().trim()
    .regex(
      /^(\d+|\d{1,3}([.,\s]\d{3})+)?$/,
      'Hạn mức sai định dạng, ví dụ 50.000.000 hoặc 50000000'
    )
    .transform((s) => Number(s.replace(/[.,\s]/g, '') || '0'))
    .refine(Number.isSafeInteger, 'Hạn mức quá lớn'),
})

export type CardFormInput = z.input<typeof CardFormSchema>
export type CardFormValues = z.output<typeof CardFormSchema>
export type CardFormErrors = Partial<Record<keyof CardFormInput, string>>

export const EMPTY_CARD_FORM: CardFormInput = {
  bankName: '',
  cardName: '',
  cardNumber: '',
  cardType: 'visa',
  statementDate: '',
  paymentDueDate: '',
  creditLimit: '',
}

export function cardToFormInput(card: CreditCard): CardFormInput {
  return {
    bankName: card.bankName,
    cardName: card.cardName,
    cardNumber: card.cardNumber,
    cardType: card.cardType,
    statementDate: String(card.statementDate),
    paymentDueDate: String(card.paymentDueDate),
    creditLimit: String(card.creditLimit),
  }
}

/** Validate form; lỗi đầu tiên của mỗi ô để hiện ngay dưới ô đó. */
export function validateCardForm(
  input: CardFormInput
): { ok: true; values: CardFormValues } | { ok: false; errors: CardFormErrors } {
  const result = CardFormSchema.safeParse(input)
  if (result.success) return { ok: true, values: result.data }
  const errors: CardFormErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof CardFormInput
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
