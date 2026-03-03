import { z } from 'zod'

export const CreditCardSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  cardName: z.string(),
  cardNumber: z.string(),         // masked: "****5678"
  cardType: z.enum(['visa', 'mastercard', 'jcb']),
  currency: z.literal('VND'),
  creditLimit: z.number().int(),
  currentBalance: z.number().int(),
  statementDate: z.number().int().min(1).max(31),   // day of month: 15
  paymentDueDate: z.number().int().min(1).max(31),  // day of month: 5
  lastUpdated: z.string().datetime(),
})

export const CreditCardTransactionSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  amount: z.number().int(),
  description: z.string(),
  merchantName: z.string(),
  category: z.string().optional(),
  type: z.enum(['purchase', 'payment', 'refund', 'fee']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),
  postedDate: z.string().datetime().optional(),
  billingCycleStart: z.string().datetime().optional(),
  billingCycleEnd: z.string().datetime().optional(),
})

export type CreditCard = z.infer<typeof CreditCardSchema>
export type CreditCardTransaction = z.infer<typeof CreditCardTransactionSchema>
