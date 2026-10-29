import { z } from 'zod'
import { StoredCategorySchema } from './categories'

export const BankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountName: z.string(),
  accountNumber: z.string(),      // masked: "****1234"
  accountType: z.enum(['checking', 'savings']),
  currency: z.literal('VND'),
  balance: z.number().int(),      // integer VND, locked decision
  lastUpdated: z.string().datetime(),
})

/**
 * Loại dòng tiền (`transactions.kind`). internal_transfer = chuyển giữa TK/thẻ của chính
 * mình (gồm trả nợ thẻ) — dashboard không tính vào thu/chi. Không có = 'normal'.
 */
export const TransactionKindSchema = z.enum(['normal', 'internal_transfer', 'cashback'])
export type TransactionKind = z.infer<typeof TransactionKindSchema>

/** Nhãn ngắn của loại dòng tiền — dùng chung cho nhãn trên dòng giao dịch và cột CSV. '' = giao dịch thường. */
export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  normal: '',
  internal_transfer: 'Nội bộ',
  cashback: 'Cashback',
}

/** Giải thích vì sao giao dịch nội bộ không có trong tổng thu/chi ở Tổng quan. */
export const INTERNAL_TRANSFER_HINT = 'Chuyển giữa tài khoản/thẻ của bạn — không tính vào thu/chi'

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number().int(),       // positive = income, negative = expense
  description: z.string(),
  merchantName: z.string().optional(),
  category: StoredCategorySchema.optional(),
  kind: TransactionKindSchema.optional(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),
  postedDate: z.string().datetime().optional(),
})

export type BankAccount = z.infer<typeof BankAccountSchema>
export type Transaction = z.infer<typeof TransactionSchema>
