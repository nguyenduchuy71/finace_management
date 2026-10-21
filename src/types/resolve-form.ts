import { z } from 'zod'
import { moneyAmountField } from './form-fields'
import { TX_RESOLVE_KINDS, type ResolveTxInput, type TxResolveKind } from './unparsed'
import type { UnparsedSuggestion } from '@/utils/unparsed-suggest'
import { vnLocalToISO } from '@/utils/unparsed-suggest'

/**
 * Form "Ghi thành giao dịch" từ một tin chưa phân loại.
 * `source` gộp TK và thẻ trong một ô chọn: "account:<id>" | "card:<id>".
 */
export const ResolveFormSchema = z.object({
  kind: z.enum(TX_RESOLVE_KINDS),
  source: z.string().regex(/^(account|card):.+$/, 'Chọn tài khoản hoặc thẻ'),
  direction: z.enum(['income', 'expense']),
  amount: moneyAmountField('Số tiền').refine((n) => n > 0, 'Nhập số tiền lớn hơn 0'),
  localDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Chọn ngày giờ giao dịch'),
  description: z.string().trim().max(300, 'Tối đa 300 ký tự'),
}).refine((v) => v.kind !== 'cashback' || v.direction === 'income', {
  // Cashback âm sẽ trừ vào thu trên tổng quan — gần như chắc chắn là chọn nhầm chiều.
  path: ['direction'], message: 'Cashback là tiền vào — chọn "Tiền vào (thu)"',
})

export type ResolveFormInput = z.input<typeof ResolveFormSchema>
export type ResolveFormErrors = Partial<Record<keyof ResolveFormInput, string>>

/** Chiều mặc định theo loại khi tin không ghi dấu: cashback là tiền vào, còn lại coi là chi. */
function defaultDirection(kind: TxResolveKind): 'income' | 'expense' {
  return kind === 'cashback' ? 'income' : 'expense'
}

export function initialResolveForm(
  s: UnparsedSuggestion, kind: TxResolveKind, source: string,
): ResolveFormInput {
  return {
    kind,
    source,
    direction: s.direction ?? defaultDirection(kind),
    amount: s.amount ? String(s.amount) : '',
    localDateTime: s.localDateTime,
    description: '',
  }
}

/** Validate + đổi sang payload của RPC (số tiền có dấu, ngày ISO có offset +07:00). */
export function validateResolveForm(
  input: ResolveFormInput,
): { ok: true; kind: TxResolveKind; tx: ResolveTxInput } | { ok: false; errors: ResolveFormErrors } {
  const r = ResolveFormSchema.safeParse(input)
  if (!r.success) {
    const errors: ResolveFormErrors = {}
    for (const issue of r.error.issues) {
      const key = issue.path[0] as keyof ResolveFormInput
      if (!errors[key]) errors[key] = issue.message
    }
    return { ok: false, errors }
  }
  const v = r.data
  const [type, id] = [v.source.slice(0, v.source.indexOf(':')), v.source.slice(v.source.indexOf(':') + 1)]
  return {
    ok: true,
    kind: v.kind,
    tx: {
      amount: v.direction === 'income' ? v.amount : -v.amount,
      transactionDate: vnLocalToISO(v.localDateTime),
      description: v.description || undefined,
      ...(type === 'account' ? { accountId: id } : { cardId: id }),
    },
  }
}

/** Chọn sẵn nguồn tiền có số kết thúc bằng đuôi đoán được từ tin (chỉ khi khớp DUY NHẤT). */
export function matchSourceByRef(
  ref: string | undefined,
  accounts: { id: string; accountNumber: string }[],
  cards: { id: string; cardNumber: string }[],
): string {
  if (!ref) return ''
  const hits = [
    ...accounts.filter((a) => a.accountNumber.endsWith(ref)).map((a) => `account:${a.id}`),
    ...cards.filter((c) => c.cardNumber.endsWith(ref)).map((c) => `card:${c.id}`),
  ]
  return hits.length === 1 ? hits[0] : ''
}
