/**
 * Làm sạch chuỗi search trước khi nhúng vào filter `.or()` của PostgREST.
 *
 * PostgREST parse `.or()` bằng cú pháp phân tách bởi dấu phẩy/ngoặc, nên ký tự
 * `,` `(` `)` trong input của user sẽ PHÁ cú pháp filter (không chỉ lỗi hiển thị
 * — có thể đổi nghĩa cả câu truy vấn). `%` và `_` là wildcard của LIKE.
 * Loại bỏ hết thay vì escape: search tiếng Việt không cần các ký tự này.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()%_\\*"']/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Cursor keyset: (transaction_date, id) — ổn định hơn offset khi có row mới chèn vào. */
export function encodeCursor(row: { transaction_date: string; id: string }): string {
  return btoa(`${row.transaction_date}|${row.id}`)
}

// Cursor được nội suy THẲNG vào chuỗi filter của PostgREST trong
// transactionQuery.ts (`or(transaction_date.lt.${date},...)`), nên phải validate
// chặt trước khi dùng — kiểm chứng thật: cursor có date = "2020-01-01,id.not.is.null"
// làm điều kiện keyset bị vô hiệu và trả về CẢ những row đáng lẽ bị loại.
// Cursor hiện chỉ do server sinh (không đọc từ URL), nên đây là phòng thủ theo
// chiều sâu + chặn cursor hỏng từ cache cũ gây phân trang sai/lặp vô hạn.
// Chấp nhận mọi biến thể timestamptz mà PostgREST có thể trả: 'T' hoặc space,
// giây thập phân tuỳ chọn, offset dạng +00:00 / +0000 / +00 / Z / không có.
// (DB hiện trả '2029-12-31T17:00:00+00:00' — đã kiểm tra thật; các dạng còn lại
// để phòng thay đổi driver/PostgREST, vì regex quá chặt sẽ làm CHẾT phân trang.)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function decodeCursor(cursor: string): { date: string; id: string } | null {
  try {
    const [date, id] = atob(cursor).split('|')
    if (!date || !id) {
      console.warn('[pagination] cursor sai định dạng, bỏ qua và trả về trang đầu:', cursor)
      return null
    }
    if (!ISO_DATE_RE.test(date) || !UUID_RE.test(id)) {
      // Từ chối thay vì "cố dùng": giá trị lạ ở đây nghĩa là cursor bị sửa hoặc
      // hỏng, và nội suy nó vào filter sẽ âm thầm trả về dữ liệu sai.
      console.warn('[pagination] cursor không hợp lệ (date/id sai khuôn), trả về trang đầu')
      return null
    }
    return { date, id }
  } catch {
    // Cursor hỏng -> trả null; caller bỏ điều kiện keyset và trả trang đầu.
    // Log lại vì im lặng sẽ rất khó debug khi phân trang chạy sai.
    console.warn('[pagination] không decode được cursor:', cursor)
    return null
  }
}
