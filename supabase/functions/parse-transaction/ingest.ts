// Bước nạp dùng chung giữa edge function (index.ts) và script backfill-unparsed.ts:
// parse -> chốt kind -> resolve FK -> insert. Nhận Supabase client (service_role)
// làm tham số để script chạy ngoài edge runtime dùng lại đúng logic này. Ghi giao dịch KHÔNG nằm ở đây:
// mọi insert đi qua credit-ingest.ts (RPC ingest_transaction) để trừ credit nguyên tử.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parsers } from './parsers.ts'
import { withKind } from './internal-transfer.ts'
import type { ParsedTransaction } from './types.ts'

export type ParseOutcome =
  | { status: 'parsed'; tx: ParsedTransaction }
  | { status: 'invalid'; bank: string } // regex khớp nhưng ra NaN / ngày hỏng
  | { status: 'no_match' }

/**
 * Tin OTP / bảo mật — không phải giao dịch, và KHÔNG được lưu (mã còn hiệu lực).
 * Bao phủ mọi biến thể dấu của "ma xac thuc" (a/á/à/ả/ã/ạ, u/ư/ứ/ừ/ự...): bản cũ chỉ
 * có dạng không dấu nên OTP có dấu lọt xuống unparsed_messages nguyên văn.
 */
export function isOtp(text: string): boolean {
  return /OTP|m[aáàảãạ]\s*x[aáàảãạ]c\s*th[uưúùủũụứừửữự]c/i.test(text)
}

/** Chạy lần lượt các parser trên text ĐÃ normalizeInput(). `now` = thời điểm nhận tin. */
export function parseNotification(text: string, ownerNames: string[], now?: number): ParseOutcome {
  for (const parser of parsers) {
    const parsed = parser(text, now)
    if (!parsed) continue
    // Regex có thể khớp nhưng cho ra dữ liệu vô nghĩa (NaN/0 amount, ngày không hợp lệ).
    if (!Number.isFinite(parsed.amount) || parsed.amount === 0
        || Number.isNaN(Date.parse(parsed.transaction_date))) {
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

/** Tên bank_name MoMo đặt trong parser và trong bảng accounts (so khớp chính xác). */
const MOMO_BANK_NAME = 'MoMo'

export type Refs = { account_id?: string; card_id?: string }

/**
 * Tìm account_id / card_id từ (bank_name, account_ref).
 * Không khớp, hoặc khớp NHIỀU (2 TK cùng bank cùng đuôi) -> {}. Caller không được
 * insert khi {}: row FK null KHÔNG hiện trong danh sách nhưng dashboard vẫn đếm.
 *
 * Ngoại lệ MoMo: tin không có số TK (account_ref null) nên gắn theo "ví MoMo duy nhất" của user.
 * Đúng 1 tài khoản bank_name 'MoMo' -> gắn; 0 hoặc >= 2 -> {} (vào hộp tin, reason no_account).
 */
export async function resolveRefs(
  db: SupabaseClient,
  p: ParsedTransaction,
  userId: string,
): Promise<Refs> {
  const isBank = p.source_type === 'bank'
  const isMoMoWallet = !p.account_ref && isBank && p.bank_name === MOMO_BANK_NAME
  if (!p.account_ref && !isMoMoWallet) return {}

  const table = isBank ? 'accounts' : 'credit_cards'
  const column = isBank ? 'account_number' : 'card_number'

  let query = db
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('bank_name', p.bank_name)
  if (p.account_ref) query = query.like(column, `%${escapeLike(p.account_ref)}`)
  const { data, error } = await query.limit(2)

  if (error || data?.length !== 1) return {}
  const id = data[0].id as string
  return isBank ? { account_id: id } : { card_id: id }
}
