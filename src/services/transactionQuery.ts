import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import type { Category } from '@/types/categories'
import { decodeCursor, sanitizeSearch } from './query-cursor'

/** Số giao dịch mỗi trang "Xem thêm" ở mọi danh sách lịch sử giao dịch (ngân hàng, một thẻ, nhiều thẻ). */
export const TX_PAGE_SIZE = 20

export interface TransactionFilters {
  search?: string
  dateFrom?: string | null
  dateTo?: string | null
  /** Cận trên LOẠI TRỪ (`transaction_date < dateBefore`); dateTo là cận trên bao gồm. */
  dateBefore?: string | null
  txType?: 'all' | 'income' | 'expense'
  category?: Category | 'all'
}

/** Trang rỗng — trả khi chưa chọn TK/thẻ hoặc thẻ không thể có giao dịch thu. */
export function emptyTxPage() {
  return { data: [] as never[], nextCursor: null as string | null, total: 0 }
}

/** Bộ lọc từ store -> tham số service (`search` rỗng thành undefined). Thẻ không có `category`. */
export function toTxQueryOptions(f: {
  searchQuery: string
  dateFrom: string | null
  dateTo: string | null
  txType: 'all' | 'income' | 'expense'
  category?: Category | 'all'
}): TransactionFilters {
  return {
    search: f.searchQuery || undefined,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    txType: f.txType,
    category: f.category,
  }
}

/**
 * Áp filter + phân trang keyset cho query transactions.
 *
 * Dùng chung giữa accounts.ts và creditCards.ts — logic filter y hệt nhau,
 * chỉ khác cột liên kết (account_id vs card_id).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTransactionFilters<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  cursor: string | undefined,
  limit: number,
  filters?: TransactionFilters
): T {
  let q = query
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1) as T // lấy dư 1 row để biết còn trang sau

  if (cursor) {
    const c = decodeCursor(cursor)
    if (c) {
      // Keyset: (date, id) < (cursor.date, cursor.id)
      q = q.or(
        `transaction_date.lt.${c.date},and(transaction_date.eq.${c.date},id.lt.${c.id})`
      ) as T
    }
  }

  if (filters?.search) {
    const s = sanitizeSearch(filters.search)
    if (s) {
      q = q.or(`description.ilike.%${s}%,merchant_name.ilike.%${s}%`) as T
    }
  }
  if (filters?.dateFrom) q = q.gte('transaction_date', filters.dateFrom) as T
  if (filters?.dateTo) q = q.lte('transaction_date', filters.dateTo) as T
  if (filters?.dateBefore) q = q.lt('transaction_date', filters.dateBefore) as T
  if (filters?.txType === 'income') q = q.gt('amount', 0) as T
  if (filters?.txType === 'expense') q = q.lt('amount', 0) as T
  if (filters?.category && filters.category !== 'all') {
    q = q.eq('category', filters.category) as T
  }

  return q
}

/**
 * `count` của PostgREST áp theo ĐÚNG query gửi đi. Từ trang 2 trở đi query có
 * thêm điều kiện keyset nên count chỉ còn số row CÒN LẠI, không phải tổng thật
 * (đo được: trang1=1203 -> trang2=1183).
 *
 * Chỉ tin `total` ở trang đầu (cursor rỗng); các trang sau trả 0 để không ai
 * vô tình hiển thị số sai. UI muốn tổng thì giữ lại giá trị của trang đầu.
 */
export function totalForPage(count: number | null, cursor: string | undefined): number {
  return cursor ? 0 : (count ?? 0)
}

/**
 * Option `count` cho `.select()`: chỉ đếm ở trang ĐẦU.
 *
 * `count: 'exact'` bắt Postgres chạy COUNT(*) trên toàn bộ tập đã lọc ở MỌI
 * request — trong khi totalForPage() ở trên vứt bỏ con số đó từ trang 2 trở đi.
 * Tức là trang 2..N trả tiền quét toàn bảng để lấy một giá trị không ai dùng
 * (exports.ts phân trang tới 100 trang). Trả undefined để bỏ hẳn việc đếm.
 */
export function countOption(cursor: string | undefined): { count?: 'exact' } {
  return cursor ? {} : { count: 'exact' }
}

/**
 * Cột cần cho mapTransaction / mapCreditCardTransaction / encodeCursor — KHÔNG dùng `*`.
 *
 * `select('*')` kéo thêm raw_text (NGUYÊN VĂN tin nhắn ngân hàng: số dư, tên người
 * chuyển), user_id, bank_name, currency, created_at, source_type, account_ref —
 * không mapper nào đọc. Với trang export 500 row thì riêng raw_text đã chiếm phần
 * lớn payload, và gửi PII về browser mà không dùng đến là rủi ro không cần thiết.
 */
export const TX_COLUMNS =
  'id, account_id, card_id, amount, description, merchant_name, category, mcc, kind, status, transaction_date'

/** Cắt row dư, tính nextCursor. */
export function paginate<T extends { transaction_date: string; id: string }>(
  rows: T[],
  limit: number
): { rows: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
}
