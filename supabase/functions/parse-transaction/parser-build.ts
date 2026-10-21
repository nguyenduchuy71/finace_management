import type { ParsedTransaction } from './types.ts'

/**
 * Gom các field lặp lại ở mọi parser (currency, raw_text) về một chỗ.
 * Parser chỉ cần khai phần KHÁC NHAU giữa các bank.
 */
export type ParserResult = Omit<ParsedTransaction, 'currency' | 'raw_text'>

export const build = (text: string, r: ParserResult): ParsedTransaction =>
  ({ ...r, currency: 'VND', raw_text: text })
