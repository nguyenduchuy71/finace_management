// Truy cập DB của parse-transaction: chống trùng, ghi giao dịch, ghi hộp tin chưa phân loại.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyUnparsed } from './classify-unparsed.ts'
import { ingestParsed } from './credit-ingest.ts'
import { resolveRefs, type Refs } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

/** Shortcut gửi lại / automation chạy 2 lần trong khoảng này -> coi là trùng. */
const DEDUP_WINDOW_MS = 10 * 60_000

export type InsertResult =
  | { kind: 'no_account' }
  | { kind: 'inserted'; refs: Refs }
  /** Hết credit: tin giữ trong hộp tin, sẽ được ghi khi nạp (replay_held_messages). */
  | { kind: 'held' }
  /** Hết credit và đã đủ trần tin treo — tin KHÔNG được lưu. */
  | { kind: 'held_full' }

export function createIngestStore(supabase: SupabaseClient) {
  /**
   * Cùng nguyên văn thông báo đã ghi trong DEDUP_WINDOW_MS -> trùng.
   *
   * Chỉ bắt được lần gửi LẶP của cùng 1 thông báo. Cùng giao dịch về qua 2 kênh
   * (SMS + app) có text khác nhau nên KHÔNG bắt được — mỗi bank chỉ bật 1 kênh.
   * Không dùng unique constraint vì MoMo không có giờ trong text: 2 ly cà phê cùng
   * quán cách nhau 1 tiếng là 2 giao dịch thật có text y hệt nhau.
   */
  async function isDuplicate(text: string, userId: string): Promise<boolean> {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
    // Tin lặp có thể đã thành giao dịch, HOẶC đã vào hộp tin chưa phân loại
    // (không kiểm bảng này thì hộp hiện 2 dòng cho cùng một thông báo).
    const [tx, unparsed] = await Promise.all([
      supabase.from('transactions').select('id')
        .eq('user_id', userId).eq('raw_text', text).gte('created_at', since).limit(1),
      supabase.from('unparsed_messages').select('id')
        .eq('user_id', userId).eq('raw_text', text).gte('received_at', since).limit(1),
    ])
    return (tx.data?.length ?? 0) > 0 || (unparsed.data?.length ?? 0) > 0
  }

  /**
   * Lưu tin không ghi được thành giao dịch: vào hộp "Chưa phân loại" của user
   * (kèm gợi ý loại để ẩn quảng cáo) và là nguồn mẫu để viết regex parser mới.
   */
  async function saveUnparsed(
    text: string, source: string | null, reason: string, userId: string,
    suggested = classifyUnparsed(text),
  ) {
    // user_id bắt buộc (NOT NULL từ migration 20261021100000) — tin hiện trong hộp
    // "Chưa phân loại" của user. Lỗi không chặn response cho Shortcut nhưng phải lộ
    // ra log: trước đây bị nuốt im lặng, mất luôn mẫu để viết parser.
    const { error } = await supabase
      .from('unparsed_messages')
      .insert({
        raw_text: text, source, reason, user_id: userId,
        suggested_kind: suggested,
      })
    if (error) console.error('saveUnparsed failed', error.code, error.message)
  }

  /**
   * Ghi giao dịch + trừ credit (một RPC nguyên tử) + resolve FK. Chưa có TK/thẻ khớp -> KHÔNG ghi giao dịch mồ côi (dashboard
   * đếm, danh sách không hiện) mà đưa vào hộp tin; tạo TK rồi chạy backfill-unparsed.ts.
   */
  async function insertTx(
    parsed: ParsedTransaction, userId: string, source: string | null,
  ): Promise<InsertResult> {
    const refs = await resolveRefs(supabase, parsed, userId)
    if (!refs.account_id && !refs.card_id) {
      await saveUnparsed(parsed.raw_text, source, 'no_account', userId, 'transaction')
      return { kind: 'no_account' }
    }
    // Chỉ giao dịch GHI được mới bị trừ: tin no_account ở trên, OTP, trùng, no_match đều miễn phí.
    const res = await ingestParsed(supabase, parsed, refs, userId, source)
    return res.status === 'inserted' ? { kind: 'inserted', refs } : { kind: res.status }
  }

  return { isDuplicate, saveUnparsed, insertTx }
}

export type IngestStore = ReturnType<typeof createIngestStore>
