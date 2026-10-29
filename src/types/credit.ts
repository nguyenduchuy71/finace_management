import { z } from 'zod'

/**
 * Số dư credit (bảng `credit_balances`, user chỉ ĐỌC). `unlimited` do chủ app đặt bằng SQL
 * (docs/claude/database-schema.md): không bị trừ credit, không bị giữ tin — UI hiện "Không giới hạn".
 */
export const CreditBalanceSchema = z.object({
  balance: z.number().int().nonnegative(),
  unlimited: z.boolean(),
})
export type CreditBalance = z.infer<typeof CreditBalanceSchema>

/** Khớp CHECK `credit_ledger.kind`. */
export const CreditKindSchema = z.enum(['grant', 'purchase', 'usage', 'refund', 'adjust'])
export type CreditKind = z.infer<typeof CreditKindSchema>

export const CreditLedgerEntrySchema = z.object({
  id: z.number().int(),
  delta: z.number().int(),
  kind: CreditKindSchema,
  createdAt: z.string().datetime(),
})
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>

export const CREDIT_KIND_LABEL: Record<CreditKind, string> = {
  grant: 'Tặng',
  purchase: 'Nạp',
  usage: 'Ghi giao dịch',
  refund: 'Hoàn',
  adjust: 'Điều chỉnh',
}

/** Dưới ngưỡng này header chuyển sang cảnh báo "sắp hết credit". */
export const LOW_CREDIT_THRESHOLD = 10

/** Số dòng sổ cái trang Cài đặt hiện (mới nhất trước). */
export const CREDIT_LEDGER_LIMIT = 50

export const UNLIMITED_LABEL = 'Không giới hạn'
