import { z } from 'zod'

/** Gợi ý của máy lúc nạp (edge function `classifyUnparsed`). null = tin cũ chưa backfill. */
export const SuggestedKindSchema = z.enum(['transaction', 'card_reminder', 'promo', 'unknown'])

/** Loại user chốt khi xử lý tin — 3 loại đầu tạo giao dịch (khớp `transactions.kind`). */
export const ResolveKindSchema = z.enum(['normal', 'internal_transfer', 'cashback', 'card_reminder', 'promo'])

export const TX_RESOLVE_KINDS = ['normal', 'internal_transfer', 'cashback'] as const
export type TxResolveKind = (typeof TX_RESOLVE_KINDS)[number]

export const UnparsedMessageSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  source: z.string().nullable(),
  receivedAt: z.string().datetime(),
  suggestedKind: SuggestedKindSchema.nullable(),
})

export type SuggestedKind = z.infer<typeof SuggestedKindSchema>
export type ResolveKind = z.infer<typeof ResolveKindSchema>
export type UnparsedMessage = z.infer<typeof UnparsedMessageSchema>

/** Giao dịch tạo từ tin — đúng một trong accountId / cardId. */
export interface ResolveTxInput {
  amount: number              // VND, dương = thu, âm = chi, khác 0
  transactionDate: string     // ISO-8601 CÓ offset (RPC từ chối nếu thiếu)
  description?: string
  merchantName?: string
  accountId?: string
  cardId?: string
}

export const RESOLVE_KIND_LABEL: Record<ResolveKind, string> = {
  normal: 'Chi/thu thường',
  internal_transfer: 'Chuyển nội bộ',
  cashback: 'Nhận cashback',
  card_reminder: 'Nhắc thanh toán thẻ',
  promo: 'Quảng cáo / bỏ qua',
}
