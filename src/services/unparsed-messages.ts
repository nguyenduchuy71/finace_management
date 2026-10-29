import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { toApiError, countRows, readFunctionErrorCode } from './api-errors'
import type { ApiError } from '@/types/api'
import { toISO } from './row-values'
import {
  UnparsedMessageSchema, type ResolveKind, type ResolveTxInput, type UnparsedMessage,
} from '@/types/unparsed'

/**
 * Cột tường minh, không `*`: không kéo `kind`/`transaction_id`/`user_id` không dùng tới.
 * `raw_text` là nguyên văn thông báo (số dư, tên, STK) — cần để user đọc và phân loại,
 * RLS chỉ cho chính chủ đọc.
 */
const UNPARSED_COLUMNS = 'id, raw_text, source, received_at, suggested_kind, reason'

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
  reason: string | null
}

function mapUnparsed(row: UnparsedRow): UnparsedMessage {
  return UnparsedMessageSchema.parse({
    id: row.id,
    // Thông báo iOS thường là NFD (dấu tách rời) — chuẩn hoá để hiển thị và đoán số tiền.
    rawText: row.raw_text.normalize('NFC'),
    source: row.source,
    receivedAt: toISO(row.received_at),
    suggestedKind: row.suggested_kind,
    onHold: row.reason === 'no_credit',
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
  return countRows(
    supabase
      .from('unparsed_messages')
      .select('id', { count: 'exact', head: true })
      .eq('resolved', false)
      .or(NOT_PROMO),
  )
}

/** Thông điệp theo mã lỗi của edge function `resolve-unparsed`. */
const RESOLVE_ERRORS: Record<string, string> = {
  insufficient_credit: 'Hết credit — nạp thêm để phân loại.',
  suspended: 'Tài khoản đang bị khoá, không phân loại được tin.',
  not_found: 'Không tìm thấy tin, tài khoản hoặc thẻ (có thể đã bị xoá).',
  invalid_request: 'Tin đã được xử lý, đang chờ nạp credit, hoặc dữ liệu giao dịch không hợp lệ.',
  account_gone: 'Tài khoản hoặc thẻ vừa bị xoá. Chọn lại nguồn tiền.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

async function toResolveError(error: unknown): Promise<ApiError> {
  const code = await readFunctionErrorCode(error)
  console.error('[resolve-unparsed]', code)
  return { code, message: RESOLVE_ERRORS[code] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.' }
}

/**
 * Xử lý một tin qua edge function `resolve-unparsed` (RPC nguyên tử: tạo giao dịch + trừ 1 credit + đánh dấu tin).
 * Loại normal / internal_transfer / cashback cần `tx` và TỐN 1 credit (unlimited miễn phí); card_reminder / promo
 * không tạo giao dịch nên miễn phí. Web không còn ghi giao dịch trực tiếp (không có quyền INSERT transactions).
 * Trả id giao dịch đã tạo (hoặc null). Hết credit -> ApiError code `insufficient_credit`.
 */
export async function resolveUnparsed(
  messageId: string, kind: ResolveKind, tx?: ResolveTxInput,
): Promise<string | null> {
  let res: { data: unknown; error: unknown }
  try {
    res = await supabase.functions.invoke('resolve-unparsed', {
      body: {
        message_id: messageId,
        kind,
        tx: tx
          ? {
              amount: tx.amount,
              transaction_date: tx.transactionDate,
              description: tx.description ?? null,
              merchant_name: tx.merchantName ?? null,
              account_id: tx.accountId ?? null,
              card_id: tx.cardId ?? null,
            }
          : null,
      },
    })
  } catch (e) {
    // invoke có thể throw khi mất mạng.
    throw await toResolveError(e)
  }
  if (res.error) throw await toResolveError(res.error)
  const parsed = z.object({ transaction_id: z.string().uuid().nullable() }).safeParse(res.data)
  if (!parsed.success) {
    console.error('[resolve-unparsed] invalid response', parsed.error.issues)
    throw { code: 'invalid_response', message: 'Phản hồi không đúng định dạng. Vui lòng thử lại.' } satisfies ApiError
  }
  return parsed.data.transaction_id
}
