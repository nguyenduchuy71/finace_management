// Tiện ích dùng chung cho mọi parser.
//
// Gom về đây để 10+ parser không phải lặp lại cùng một logic (DRY) — đặc biệt là
// dựng chuỗi ngày ISO, trước đây mỗi parser tự nối chuỗi theo 9 cách khác nhau.

/**
 * Chuẩn hoá text đầu vào TRƯỚC mọi regex.
 *
 * Phần lớn thông báo iOS về dạng Unicode NFD (dấu tách rời: "ố" = o + U+0302 +
 * U+0301), còn regex trong source là NFC -> "Số tiền" không khớp dù nhìn y hệt.
 * Đo trên 99 tin thật (21/10/2026): chỉ 9 tin khớp parser khi chưa chuẩn hoá.
 */
export function normalizeInput(text: string): string {
  return text.normalize('NFC').trim()
}

/** "1,234,567" hoặc "1.234.567" -> 1234567. Giữ dấu +/- nếu có. */
export function parseVND(numStr: string): number {
  return parseFloat(numStr.replace(/[,.]/g, ''))
}

/** Lấy 4 ký tự cuối làm mã nhận diện thẻ/TK.
 *
 * Dùng KÝ TỰ chứ không phải chữ số, vì mỗi bank mask một kiểu:
 * "4074***2789" -> "2789", "03xxx265" -> "x265" (LPBank chỉ để lộ 3 số cuối).
 * Seed accounts/credit_cards phải dùng đúng chuỗi này ở cuối account_number
 * thì `like '%<ref>'` mới resolve được FK.
 */
export function last4(s: string): string | null {
  const tail = s.trim().slice(-4)
  return tail.length === 4 ? tail : null
}

/**
 * Dựng chuỗi ISO-8601 theo giờ VN (+07:00) từ các thành phần rời.
 *
 * Nhận cả năm 2 chữ số ("26") lẫn 4 chữ số ("2026"). Thay cho việc mỗi parser
 * tự nối template string — nguồn lỗi âm thầm khi thiếu padding hoặc sai thứ tự.
 */
export function vnDate(
  yy: string, mm: string, dd: string,
  hh = '00', min = '00', ss = '00',
): string {
  const year = yy.length === 2 ? `20${yy}` : yy
  const p = (v: string) => v.padStart(2, '0')
  return `${year}-${p(mm)}-${p(dd)}T${p(hh)}:${p(min)}:${p(ss)}+07:00`
}

/**
 * Thời điểm hiện tại theo giờ VN, cùng định dạng với vnDate().
 *
 * Cho thông báo KHÔNG ghi ngày giờ (BIDV push, SHB SAHA): push đến gần như tức
 * thì sau giao dịch nên thời điểm nạp là xấp xỉ tốt nhất.
 */
export function nowVN(now = Date.now()): string {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 19) + '+07:00'
}

/**
 * Suy năm cho SMS KHÔNG chứa năm (VPBank, và một số bank chỉ ghi "24/08").
 *
 * Lấy năm hiện tại; nếu ra ngày ở tương lai quá 1 ngày thì tin nhắn thuộc năm
 * trước (bắt được lỗi quanh giao thừa: SMS 31/12 nhận ngày 01/01).
 */
export function inferYear(
  mm: string, dd: string, hh: string, min: string, now = Date.now(),
): string {
  let year = new Date(now).getFullYear()
  const candidate = new Date(vnDate(String(year), mm, dd, hh, min))
  if (candidate.getTime() > now + 86_400_000) year -= 1
  return String(year)
}
