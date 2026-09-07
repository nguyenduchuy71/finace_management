// Shape của 1 giao dịch đã bóc tách từ text thô của ngân hàng.
// Dùng chung giữa parsers.ts và index.ts.

export interface ParsedTransaction {
  bank_name: string
  amount: number // dương = tiền vào, âm = tiền ra
  currency: string
  transaction_date: string // ISO 8601, giờ VN (+07:00)
  description: string
  raw_text: string

  // Phân biệt tài khoản ngân hàng vs thẻ tín dụng. Mỗi parser tự biết
  // ngữ cảnh của bank mình nên hardcode được, không phải đoán từ text.
  source_type: 'bank' | 'credit_card'

  // 4 số cuối của thẻ/TK — dùng để resolve account_id/card_id.
  // Regex mỗi bank đã bắt được sẵn, trước đây bị bỏ đi.
  account_ref: string | null

  // Tên merchant tách riêng khỏi description, để classifyTransaction()
  // ở frontend phân loại chính xác hơn.
  merchant_name: string | null
}

export type Parser = (text: string) => ParsedTransaction | null
