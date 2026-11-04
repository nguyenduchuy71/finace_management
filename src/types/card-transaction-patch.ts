import { z } from 'zod'
import { TransactionKindSchema } from './account'
import { CategorySchema } from './categories'
import { MccSchema } from './creditCard'

/** Các trường sửa được của giao dịch thẻ; trường vắng = giữ nguyên. null = xoá giá trị. */
export const CardTransactionPatchSchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, 'Số tiền phải khác 0'),
  // Ngày phải có offset/Z: chuỗi không offset bị Postgres hiểu theo timezone của phiên.
  transactionDate: z.string().datetime({ offset: true }),
  merchantName: z.string().trim().max(200).nullable(),
  description: z.string().trim().max(300).nullable(),
  category: CategorySchema.nullable(),
  kind: TransactionKindSchema,
  mcc: MccSchema.nullable(),
}).partial().strict()

export type CardTransactionPatch = z.input<typeof CardTransactionPatchSchema>
