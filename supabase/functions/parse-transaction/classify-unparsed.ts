// Gợi ý loại cho tin KHÔNG parse được (unparsed_messages.suggested_kind), để hộp
// "Chưa phân loại" ẩn quảng cáo. Chỉ là GỢI Ý — user chốt `kind` khi xử lý.
//
// Thiết kế ưu tiên RECALL: giao dịch thật bị gắn 'promo' là bị giấu khỏi user,
// còn quảng cáo lọt vào hộp chỉ tốn một cú bấm. Vì vậy thứ tự xét:
//   card_reminder -> transaction -> promo (cần tín hiệu marketing rõ) -> unknown.
// Đo trên 99 tin thật (21/10/2026): xem classify-unparsed.test.ts.
// Input phải đã qua normalizeInput() (NFC).

export type SuggestedKind = 'transaction' | 'card_reminder' | 'promo' | 'unknown'

// Sao kê / dư nợ / số tiền tối thiểu — có dấu hoặc không dấu (HDBank gửi không dấu).
const CARD_REMINDER = /Tong du no|Dư nợ cuối kỳ|thanh to[aá]n t[oố]i thi[eể]u/i

// Số tiền CÓ DẤU kèm đơn vị: "-48.750 đ", "+10,000 VND", "+  VND 10,000", "-10,000\n".
// Loại "+2,2%/năm" (có %) và "+10,000 điểm" (đ là chữ cái đầu của từ khác).
// Cùng quy tắc với SIGNED trong src/utils/unparsed-suggest.ts (khác runtime, không import chéo
// được) — sửa một bên thì sửa cả bên kia.
const SIGNED_AMOUNT =
  /(?:^|[\s:(])[+-]\s*(?:VND\s*\d[\d.,]{2,}|\d[\d.,]{2,}\s*(?:VND|đ(?![a-zà-ỹ])|\n))/im

// Nhãn chỉ xuất hiện trong thông báo biến động thật.
const TX_LABELS = new RegExp(
  [
    'Số tiền(?: GD)?:\\s*[+-]?\\d',
    'Giao dịch:\\s*[+-]\\d',
    'Phát sinh\\s*[+-]',
    'thay đổi\\s*[+-]',
    'vừa (?:tăng|giảm)\\s+\\d',
    'biến động số dư',
    'đã thanh toán\\s+[\\d.,]+\\s*(?:VND|đ)',
    'thanh toán thành công cho .{1,80}? với số tiền',
  ].join('|'),
  'i',
)

// Tín hiệu marketing: emoji/ký hiệu trang trí hoặc từ khoá kêu gọi.
const PROMO = new RegExp(
  [
    '\\p{Extended_Pictographic}',
    'ưu đãi', 'lãi suất', 'giảm (?:đến|ngay|\\d)', 'voucher', 'khám phá', 'ngay!', 'mở thẻ',
    'tiết kiệm', 'đăng ký', 'trả góp', 'hoàn (?:tiền|\\d)', 'tặng', 'quà', 'sinh lời',
    'chúc mừng', 'cập nhật', 'https?://', 'điểm', 'vay ', 'trái phiếu', 'xem ngay',
  ].join('|'),
  'iu',
)

export function classifyUnparsed(text: string): SuggestedKind {
  if (CARD_REMINDER.test(text)) return 'card_reminder'
  if (SIGNED_AMOUNT.test(text) || TX_LABELS.test(text)) return 'transaction'
  if (PROMO.test(text)) return 'promo'
  return 'unknown'
}
