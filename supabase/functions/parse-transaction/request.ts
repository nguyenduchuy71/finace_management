// Giới hạn + kiểm tra request của parse-transaction. Thuần (không I/O) để test được.

import { normalizeInput } from './helpers.ts'

/** Thông báo ngân hàng thật < 500 ký tự. Xem lý do ở handler.ts. KHÔNG được bỏ. */
export const MAX_TEXT_LENGTH = 2000
export const MAX_SOURCE_LENGTH = 50
/**
 * Trần body thô, kiểm TRƯỚC JSON.parse: text 2000 ký tự (tối đa 4 byte/ký tự UTF-8,
 * NFD còn nhân thêm dấu tách) + source + khung JSON. Không có trần này thì request đã
 * xác thực vẫn bắt function parse JSON tuỳ ý lớn rồi mới tới MAX_TEXT_LENGTH.
 */
export const MAX_BODY_LENGTH = 16_000

export type IngestRequest =
  | { ok: true; text: string; source: string | null }
  | { ok: false; status: 400 | 413; body: Record<string, unknown> }

/** Body đã JSON.parse -> text (đã NFC + trim) và source; hoặc lỗi 400/413. */
export function parseIngestBody(value: unknown): IngestRequest {
  const body = value as { text?: unknown; source?: unknown } | null
  const text = typeof body?.text === 'string' ? normalizeInput(body.text) : ''
  if (!text) return { ok: false, status: 400, body: { error: 'missing text' } }
  // Tên bank do automation gắn cứng (mỗi app 1 automation). Chỉ lưu kèm
  // unparsed_messages để biết tin lạ đến từ app nào khi viết parser mới —
  // bank_name của giao dịch do parser tự đặt, không lấy từ đây.
  const source = typeof body?.source === 'string' && body.source.trim()
    ? body.source.trim().slice(0, MAX_SOURCE_LENGTH)
    : null
  // Chặn payload dài TRƯỚC khi chạy parser (xem handler.ts).
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, status: 413, body: { error: 'text too long', max: MAX_TEXT_LENGTH } }
  }
  return { ok: true, text, source }
}
