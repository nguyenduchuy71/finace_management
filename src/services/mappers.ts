import type { PostgrestError } from '@supabase/supabase-js'
import { BankAccountSchema, TransactionSchema } from '@/types/account'
import { CreditCardSchema, CreditCardTransactionSchema } from '@/types/creditCard'
import type { ApiError } from '@/types/api'

/** Row của bảng `transactions` (snake_case, như PostgREST trả về). */
export interface TransactionRow {
  id: string
  bank_name: string
  amount: number | string   // bigint có thể về dạng string tuỳ driver
  currency: string
  transaction_date: string
  description: string | null
  raw_text: string | null
  created_at: string
  user_id: string | null
  source_type: 'bank' | 'credit_card' | null
  account_ref: string | null
  account_id: string | null
  card_id: string | null
  merchant_name: string | null
  category: string | null
  status: 'pending' | 'posted'
}

export interface AccountRow {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  account_type: 'checking' | 'savings'
  currency: string
  balance: number | string
  last_updated: string
}

export interface CreditCardRow {
  id: string
  bank_name: string
  card_name: string
  card_number: string
  card_type: 'visa' | 'mastercard' | 'jcb' | 'amex'
  currency: string
  credit_limit: number | string
  current_balance: number | string
  statement_date: number
  payment_due_date: number
  last_updated: string
}

/** bigint/numeric của Postgres có thể về dạng string; VND < 2^53 nên Number() an toàn. */
const toInt = (v: number | string): number => Math.round(Number(v))

/**
 * Chuẩn hoá timestamptz của Postgres về ISO-8601 dạng `Z`.
 *
 * PostgREST trả "2026-08-05T03:00:00+00:00" nhưng Zod `.datetime()` chỉ chấp nhận
 * hậu tố `Z`, nên parse thẳng sẽ fail "Invalid ISO datetime".
 * Frontend đã coi mọi timestamp là UTC rồi đổi sang giờ VN khi hiển thị
 * (utils/dates.ts), nên toISOString() giữ nguyên đúng thời điểm.
 */
const toISO = (v: string): string => new Date(v).toISOString()

export function mapTransaction(row: TransactionRow) {
  const amount = toInt(row.amount)
  // account_id không bao giờ null ở đây: getTransactions luôn lọc
  // .eq('account_id', ...) nên row chưa resolve FK không thể lọt vào.
  // Dùng '' làm fallback để Zod bắt được ngay nếu giả định này sai.
  return TransactionSchema.parse({
    id: row.id,
    accountId: row.account_id ?? '',
    amount,
    description: row.description ?? '',
    merchantName: row.merchant_name ?? undefined,
    category: row.category ?? undefined,
    type: amount >= 0 ? 'income' : 'expense',
    status: row.status,
    transactionDate: toISO(row.transaction_date),
  })
}

export function mapCreditCardTransaction(row: TransactionRow) {
  const amount = toInt(row.amount)
  return CreditCardTransactionSchema.parse({
    id: row.id,
    cardId: row.card_id ?? '',
    amount,
    description: row.description ?? '',
    merchantName: row.merchant_name ?? row.description ?? '',
    category: row.category ?? undefined,
    // Parser chỉ suy được purchase; tiền vào thẻ = thanh toán dư nợ.
    type: amount > 0 ? 'payment' : 'purchase',
    status: row.status,
    transactionDate: toISO(row.transaction_date),
    // billingCycleStart/End không lưu DB — utils/billingCycle.ts tự tính từ statement_date.
  })
}

export function mapAccount(row: AccountRow) {
  return BankAccountSchema.parse({
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    accountType: row.account_type,
    currency: row.currency,
    balance: toInt(row.balance),
    lastUpdated: toISO(row.last_updated),
  })
}

export function mapCreditCard(row: CreditCardRow) {
  return CreditCardSchema.parse({
    id: row.id,
    bankName: row.bank_name,
    cardName: row.card_name,
    cardNumber: row.card_number,
    cardType: row.card_type,
    currency: row.currency,
    creditLimit: toInt(row.credit_limit),
    currentBalance: toInt(row.current_balance),
    statementDate: row.statement_date,
    paymentDueDate: row.payment_due_date,
    lastUpdated: toISO(row.last_updated),
  })
}

/**
 * Thông điệp hiển thị cho user, theo mã lỗi Postgres.
 * Không bao giờ lộ `message`/`details` gốc: chúng chứa tên cột, tên bảng, hint
 * của PostgREST — thông tin nội bộ, và với user thì cũng vô nghĩa.
 */
const ERROR_MESSAGES: Record<string, string> = {
  '42501': 'Bạn không có quyền xem dữ liệu này.',
  '23505': 'Dữ liệu đã tồn tại.',
  P0002: 'Không tìm thấy thẻ (đã bị xoá hoặc không thuộc về bạn).',
  '23502': 'Thiếu thông tin bắt buộc.',
  '22007': 'Giá trị ngày tháng không hợp lệ.',
  '22P02': 'Dữ liệu gửi lên không đúng định dạng.',
  PGRST301: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

/**
 * Giữ nguyên contract ApiError để component không phải đổi.
 *
 * `message` giờ là chuỗi an toàn để render thẳng ra UI (TransactionList và
 * CreditCardTransactionList đang hiển thị trực tiếp field này). Chi tiết kỹ thuật
 * đẩy vào console cho dev, và `details` không còn được truyền đi.
 */
export function toApiError(e: PostgrestError): ApiError {
  const code = e.code ?? 'SUPABASE_ERROR'
  console.error('[supabase]', code, e.message, e.details ?? '')
  return {
    code,
    message: ERROR_MESSAGES[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  }
}

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
