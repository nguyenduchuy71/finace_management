import { z } from 'zod'

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

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number().int(),       // positive = income, negative = expense
  description: z.string(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),
  postedDate: z.string().datetime().optional(),
})

export type BankAccount = z.infer<typeof BankAccountSchema>
export type Transaction = z.infer<typeof TransactionSchema>
