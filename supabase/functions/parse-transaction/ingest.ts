// Bước nạp dùng chung giữa edge function (index.ts) và script backfill-unparsed.ts:
// parse -> chốt kind -> resolve FK -> insert. Nhận Supabase client (service_role)
// làm tham số để script chạy ngoài edge runtime dùng lại đúng logic này.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parsers } from './parsers.ts'
import { withKind } from './internal-transfer.ts'
import type { ParsedTransaction } from './types.ts'

export type ParseOutcome =
  | { status: 'parsed'; tx: ParsedTransaction }
  | { status: 'invalid'; bank: string } // regex khớp nhưng ra NaN / ngày hỏng
  | { status: 'no_match' }

/** Chạy lần lượt các parser trên text ĐÃ normalizeInput(). `now` = thời điểm nhận tin. */
export function parseNotification(text: string, ownerNames: string[], now?: number): ParseOutcome {
  for (const parser of parsers) {
    const parsed = parser(text, now)
    if (!parsed) continue
    // Regex có thể khớp nhưng cho ra dữ liệu vô nghĩa (NaN amount, ngày không hợp lệ).
    if (!Number.isFinite(parsed.amount) || Number.isNaN(Date.parse(parsed.transaction_date))) {
      return { status: 'invalid', bank: parsed.bank_name }
    }
    return { status: 'parsed', tx: withKind(parsed, ownerNames) }
  }
  return { status: 'no_match' }
}

/**
 * Escape ký tự wildcard của LIKE trong `account_ref`.
 *
 * `account_ref` là 4 KÝ TỰ cuối của số thẻ trong SMS (không phải 4 chữ số) — bank
 * dùng nhiều kiểu mask khác nhau nên `%` hoặc `_` có thể lọt vào
 * (vd "5239...9%08" -> ref "9%08"). Không escape thì `.like('%9%08')` sẽ khớp nhầm
 * thẻ khác và gán giao dịch sai thẻ.
 */
function escapeLike(s: string): string {
  return s.replace(/([\\%_])/g, '\\$1')
}

export type Refs = { account_id?: string; card_id?: string }

/**
 * Tìm account_id / card_id từ (bank_name, account_ref).
 * Không khớp -> trả {} để insert với FK null. LƯU Ý: row FK null KHÔNG hiện
 * trong danh sách giao dịch (mọi query đều lọc theo account_id/card_id).
 * Dùng getUnlinkedCount() ở frontend để phát hiện.
 */
export async function resolveRefs(
  db: SupabaseClient,
  p: ParsedTransaction,
  userId: string,
): Promise<Refs> {
  if (!p.account_ref) return {}

  const isBank = p.source_type === 'bank'
  const table = isBank ? 'accounts' : 'credit_cards'
  const column = isBank ? 'account_number' : 'card_number'

  const { data } = await db
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('bank_name', p.bank_name)
    .like(column, `%${escapeLike(p.account_ref)}`)
    .maybeSingle()

  if (!data) return {}
  return isBank ? { account_id: data.id } : { card_id: data.id }
}

/** Ghi giao dịch (đã resolve FK), trả id. */
export async function insertTransaction(
  db: SupabaseClient,
  tx: ParsedTransaction,
  refs: Refs,
  userId: string,
): Promise<string> {
  const { data, error } = await db
    .from('transactions')
    .insert({ ...tx, ...refs, user_id: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
