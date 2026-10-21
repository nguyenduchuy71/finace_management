import { supabase } from '@/lib/supabase'
import { mapTransaction, mapCreditCardTransaction, type TransactionRow } from './mappers'
import { toApiError } from './api-errors'
import { encodeCursor } from './query-cursor'
import { applyTransactionFilters, paginate, countOption, TX_COLUMNS, type TransactionFilters } from './transactionQuery'

// PostgREST chặn cứng ở `max_rows` (1000, xem supabase/config.toml) nên 1 request
// KHÔNG BAO GIỜ lấy được hơn 1000 row. Phải lật trang để xuất đủ.
const PAGE_SIZE = 500

// Trần an toàn: chặn vòng lặp vô hạn nếu cursor lỗi. 100 trang = 50k giao dịch,
// thừa sức cho app tài chính cá nhân.
const MAX_PAGES = 100

/**
 * Lấy TOÀN BỘ giao dịch (đã áp filter) của 1 tài khoản hoặc 1 thẻ để xuất CSV.
 *
 * Tự lật trang bằng keyset cho tới hết — trước đây chỉ lấy 1 request và bị
 * PostgREST cắt im lặng ở 1000 row (user nhận file CSV THIẾU mà không hề biết).
 *
 * @param accountOrCardId Account ID, hoặc null thì dùng filters.cardId
 * @param filters Bộ lọc đang áp ở UI
 */
export async function exportTransactions(
  accountOrCardId: string | null,
  filters?: TransactionFilters & { cardId?: string }
) {
  const isBank = Boolean(accountOrCardId)
  if (!isBank && !filters?.cardId) {
    throw new Error('Either accountOrCardId or filters.cardId must be provided')
  }

  const column = isBank ? 'account_id' : 'card_id'
  const value = isBank ? accountOrCardId! : filters!.cardId!

  const allRows: TransactionRow[] = []
  let cursor: string | undefined
  let total = 0
  let complete = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const base = supabase
      .from('transactions')
      .select(TX_COLUMNS, countOption(cursor))
      .eq(column, value)

    // Dùng chung logic filter với list view để kết quả export khớp đúng
    // những gì user đang nhìn thấy trên màn hình.
    const { data, error, count } = await applyTransactionFilters(
      base,
      cursor,
      PAGE_SIZE,
      filters
    )
    if (error) throw toApiError(error)

    // CHỈ lấy count ở trang ĐẦU: từ trang 2 trở đi query có thêm điều kiện keyset
    // nên `count` chỉ còn là số row CÒN LẠI, không phải tổng thật.
    if (page === 0) total = count ?? 0

    const { rows, hasMore } = paginate((data ?? []) as TransactionRow[], PAGE_SIZE)
    allRows.push(...rows)

    if (!hasMore || rows.length === 0) {
      complete = true
      break
    }
    cursor = encodeCursor(rows[rows.length - 1])
  }

  // Hết trần trang mà vẫn còn dữ liệu: trả về mảng thiếu sẽ làm file CSV hay khoản hoàn tiền
  // ước tính sai MÀ KHÔNG AI BIẾT. Báo lỗi rõ ràng thay vì cắt cụt im lặng.
  if (!complete) {
    throw new Error(`Quá nhiều giao dịch (vượt ${MAX_PAGES * PAGE_SIZE}) để xuất đầy đủ. Hãy thu hẹp bộ lọc.`)
  }

  return {
    data: isBank ? allRows.map(mapTransaction) : allRows.map(mapCreditCardTransaction),
    nextCursor: null,
    total,
  }
}
