import { toVietnamDate } from './dates'

/**
 * Đoán sẵn số tiền / thời điểm / đuôi TK-thẻ từ một tin chưa parse, để điền trước form
 * "Ghi thành giao dịch". CHỈ là gợi ý — user luôn xác nhận; không đoán được thì để trống.
 * Text đã chuẩn hoá NFC (service làm).
 */
export interface UnparsedSuggestion {
  /** Giá trị tuyệt đối, VND. */
  amount?: number
  /** Chỉ có khi tin ghi dấu +/- rõ ràng. */
  direction?: 'income' | 'expense'
  /** "YYYY-MM-DDTHH:mm" giờ VN — đúng định dạng ô datetime-local. */
  localDateTime: string
  /** Ký tự cuối của số TK/thẻ để chọn sẵn nguồn tiền (so khớp bằng endsWith). */
  ref?: string
}

// Số có dấu: "-48.750 đ", "+  VND 10,000", "Số tiền GD: -499,000 VND", "-10,000\n"
// Bắt buộc đơn vị (VND trước/sau, "đ", hoặc hết dòng) để không nhận "+2.2%" hay "+10,000 điểm".
const NUM = /(\d{1,3}(?:[.,]\d{3})+|\d+)/.source
const SIGNED = new RegExp(
  `(?:^|[\\s:(])([+-])\\s*(?:VND\\s*${NUM}|${NUM}\\s*(?:VND|đ(?![a-zà-ỹ])|$))`, 'm',
)
// Số không dấu đi kèm đơn vị: "với số tiền 15.000đ", "thanh toán 5,000,000 VND"
const UNSIGNED = /(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:VND|đ(?![a-zà-ỹ]))/
// "20/10/2026 17:32", "20/10 11:30", "18/10/2026 11:30:51"
const DATE_FIRST = /(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+(\d{2}):(\d{2})/
// "lúc 10:11 19/10/2026", "Thời gian giao dịch: 07:27 07/09/2026"
const TIME_FIRST = /(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/
// "Tài khoản: 104885084982", "TK 0349360265", "thẻ ••9526", "the 0702", "**0265", "800xx0300"
// (`\b` của JS chỉ hiểu ASCII — đặt sau "thẻ" sẽ không bao giờ khớp.)
const REF = /(?:tài khoản|\bTK\b|thẻ|\bthe\b)[^\d*x•\n]{0,20}([\d*x•]{4,})/i

const pad = (n: string | number) => String(n).padStart(2, '0')

export function suggestFromText(text: string, receivedAtISO: string): UnparsedSuggestion {
  const received = toVietnamDate(receivedAtISO)
  const out: UnparsedSuggestion = {
    localDateTime: `${received.getFullYear()}-${pad(received.getMonth() + 1)}-${pad(received.getDate())}T${pad(received.getHours())}:${pad(received.getMinutes())}`,
  }

  const signed = text.match(SIGNED)
  if (signed) {
    out.amount = Number((signed[2] ?? signed[3]).replace(/[.,]/g, ''))
    out.direction = signed[1] === '+' ? 'income' : 'expense'
  } else {
    const unsigned = text.match(UNSIGNED)
    if (unsigned) out.amount = Number(unsigned[1].replace(/[.,]/g, ''))
  }

  const tf = text.match(TIME_FIRST)
  const df = tf ? null : text.match(DATE_FIRST)
  if (tf) {
    const [, hh, mi, dd, mm, yyyy] = tf
    out.localDateTime = `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  } else if (df) {
    const [, dd, mm, yyyy, hh, mi] = df
    out.localDateTime = `${yyyy ?? received.getFullYear()}-${mm}-${dd}T${hh}:${mi}`
  }

  const ref = text.match(REF)
  if (ref) out.ref = ref[1].slice(-4)

  return out
}

/** "YYYY-MM-DDTHH:mm" (giờ VN, từ ô datetime-local) -> ISO có offset cho RPC. */
export function vnLocalToISO(local: string): string {
  return `${local}:00+07:00`
}
