import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { toApiError } from './mappers'
import {
  UnparsedMessageSchema, type ResolveKind, type ResolveTxInput, type UnparsedMessage,
} from '@/types/unparsed'

/**
 * Cột tường minh, không `*`: không kéo `kind`/`transaction_id`/`user_id` không dùng tới.
 * `raw_text` là nguyên văn thông báo (số dư, tên, STK) — cần để user đọc và phân loại,
 * RLS chỉ cho chính chủ đọc.
 */
const UNPARSED_COLUMNS = 'id, raw_text, source, received_at, suggested_kind'

/**
 * Hộp tin chỉ chứa phần parser bỏ sót (vài tin/ngày sau khi lọc quảng cáo), nên lấy
 * N tin mới nhất thay vì phân trang keyset. Vượt giới hạn thì UI báo còn tin cũ hơn.
 */
export const UNPARSED_PAGE_LIMIT = 200

interface UnparsedRow {
  id: string
  raw_text: string
  source: string | null
  received_at: string
  suggested_kind: string | null
}

function mapUnparsed(row: UnparsedRow): UnparsedMessage {
  return UnparsedMessageSchema.parse({
    id: row.id,
    // Thông báo iOS thường là NFD (dấu tách rời) — chuẩn hoá để hiển thị và đoán số tiền.
    rawText: row.raw_text.normalize('NFC'),
    source: row.source,
    receivedAt: new Date(row.received_at).toISOString(),
    suggestedKind: row.suggested_kind,
  })
}

/**
 * Mặc định ẩn tin máy gợi ý là quảng cáo. `suggested_kind` NULL (tin cũ chưa backfill)
 * vẫn hiện — `neq` một mình loại luôn NULL.
 */
const NOT_PROMO = 'suggested_kind.is.null,suggested_kind.neq.promo'

export async function getUnparsedMessages(includePromo = false) {
  let q = supabase
    .from('unparsed_messages')
    .select(UNPARSED_COLUMNS, { count: 'exact' })
    .eq('resolved', false)
  if (!includePromo) q = q.or(NOT_PROMO)
  const { data, error, count } = await q
    .order('received_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(UNPARSED_PAGE_LIMIT)
  if (error) throw toApiError(error)
  return { data: ((data ?? []) as UnparsedRow[]).map(mapUnparsed), total: count ?? 0 }
}

/** Số tin cần xử lý (không tính quảng cáo) — badge trên tab. */
export async function getUnparsedCount(): Promise<number> {
  const { count, error } = await supabase
    .from('unparsed_messages')
    .select('id', { count: 'exact', head: true })
    .eq('resolved', false)
    .or(NOT_PROMO)
  if (error) throw toApiError(error)
  return count ?? 0
}

const RESOLVE_ERRORS: Record<string, string> = {
  P0002: 'Không tìm thấy tin, tài khoản hoặc thẻ (có thể đã bị xoá).',
  '22023': 'Tin đã được xử lý hoặc dữ liệu giao dịch không hợp lệ.',
  '23503': 'Tài khoản hoặc thẻ vừa bị xoá. Chọn lại nguồn tiền.',
}

/**
 * Xử lý một tin qua RPC `resolve_unparsed` (nguyên tử: tạo giao dịch + đánh dấu tin).
 * Loại normal / internal_transfer / cashback cần `tx`; card_reminder / promo thì không.
 * Trả id giao dịch đã tạo (hoặc null).
 */
export async function resolveUnparsed(
  messageId: string, kind: ResolveKind, tx?: ResolveTxInput,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_unparsed', {
    p_msg_id: messageId,
    p_kind: kind,
    p_tx: tx
      ? {
          amount: tx.amount,
          transaction_date: tx.transactionDate,
          description: tx.description ?? null,
          merchant_name: tx.merchantName ?? null,
          account_id: tx.accountId ?? null,
          card_id: tx.cardId ?? null,
        }
      : null,
  })
  if (error) throw toApiError(error, RESOLVE_ERRORS)
  return z.string().uuid().nullable().parse(data)
}
