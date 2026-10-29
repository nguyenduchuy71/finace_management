import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import { supabase } from '@/lib/supabase'
import type { PaginatedResponse } from '@/types/api'
import type { TransactionRow } from './mappers'
import { toApiError } from './api-errors'
import { encodeCursor } from './query-cursor'
import {
  applyTransactionFilters, paginate, totalForPage, countOption, TX_COLUMNS, type TransactionFilters,
} from './transactionQuery'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxQuery = PostgrestFilterBuilder<any, any, any, any, any>

/** Thu hẹp phạm vi query (theo TK / thẻ / nhiều thẻ) trước khi áp filter + phân trang. */
export type TxScope = (q: TxQuery) => TxQuery

/**
 * Một trang giao dịch: select + phạm vi + filter + keyset + map. Dùng chung cho TK và thẻ
 * (chỉ khác `scope` và `mapRow`), nên kiểu trả về được ép là PaginatedResponse<T>.
 */
export async function fetchTransactionPage<T>(
  scope: TxScope,
  mapRow: (row: TransactionRow) => T,
  { cursor, limit, filters }: { cursor?: string; limit: number; filters?: TransactionFilters },
): Promise<PaginatedResponse<T>> {
  const base = scope(supabase.from('transactions').select(TX_COLUMNS, countOption(cursor)))
  const { data, error, count } = await applyTransactionFilters(base, cursor, limit, filters)
  if (error) throw toApiError(error)

  const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], limit)
  return {
    data: rows.map(mapRow),
    nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    total: totalForPage(count, cursor),
  }
}

// PostgREST chặn cứng ở `max_rows` (1000, xem supabase/config.toml) nên 1 request
// KHÔNG BAO GIỜ lấy được hơn 1000 row. Phải lật trang để lấy đủ.
const ALL_PAGE_SIZE = 500

// Trần an toàn: chặn vòng lặp vô hạn nếu cursor lỗi. 100 trang = 50k giao dịch,
// thừa sức cho app tài chính cá nhân.
const MAX_PAGES = 100

/**
 * TOÀN BỘ giao dịch (đã áp filter) trong phạm vi `scope`: tự lật trang keyset cho tới hết.
 * Trước đây chỉ lấy 1 request và bị PostgREST cắt im lặng ở 1000 row (file CSV THIẾU mà
 * không ai biết).
 */
export async function fetchAllTransactions<T>(
  scope: TxScope,
  mapRow: (row: TransactionRow) => T,
  filters?: TransactionFilters,
): Promise<PaginatedResponse<T>> {
  const all: T[] = []
  let cursor: string | undefined
  let total = 0
  let complete = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const base = scope(supabase.from('transactions').select(TX_COLUMNS, countOption(cursor)))
    // Dùng chung logic filter với list view để kết quả khớp đúng những gì user đang nhìn thấy.
    const { data, error, count } = await applyTransactionFilters(base, cursor, ALL_PAGE_SIZE, filters)
    if (error) throw toApiError(error)

    // CHỈ lấy count ở trang ĐẦU: từ trang 2 trở đi query có thêm điều kiện keyset
    // nên `count` chỉ còn là số row CÒN LẠI, không phải tổng thật.
    if (page === 0) total = count ?? 0

    const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], ALL_PAGE_SIZE)
    all.push(...rows.map(mapRow))

    if (!hasMore || rows.length === 0) {
      complete = true
      break
    }
    cursor = encodeCursor(rows[rows.length - 1])
  }

  // Hết trần trang mà vẫn còn dữ liệu: trả về mảng thiếu sẽ làm file CSV hay khoản hoàn tiền
  // ước tính sai MÀ KHÔNG AI BIẾT. Báo lỗi rõ ràng thay vì cắt cụt im lặng.
  if (!complete) {
    throw new Error(`Quá nhiều giao dịch (vượt ${MAX_PAGES * ALL_PAGE_SIZE}) để xuất đầy đủ. Hãy thu hẹp bộ lọc.`)
  }
  return { data: all, nextCursor: null, total }
}
