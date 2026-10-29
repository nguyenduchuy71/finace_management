// Ghi giao dịch + trừ credit trong MỘT lệnh DB (RPC ingest_transaction, chỉ service_role gọi được).
// Dùng chung cho edge function (persist.ts) và script backfill-unparsed.ts: không còn đường nào
// insert giao dịch tự động mà không qua credit.

import type { Refs } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

/**
 * inserted: đã ghi + trừ 1 credit | held: hết credit, tin giữ ở hộp tin (reason no_credit) | held_full: trần tin treo |
 * no_account: TK/thẻ bị xoá giữa lúc resolve và RPC (P0002 / FK 23503) — KHÔNG ghi, không trừ; người gọi đưa tin vào hộp tin.
 */
export type IngestStatus =
  | { status: 'inserted'; id: string }
  | { status: 'held'; id: string }
  | { status: 'held_full' }
  | { status: 'no_account' }

/** Mã lỗi RPC nghĩa là "TK/thẻ không còn / không thuộc user" (P0002 từ _insert_parsed_tx, 23503 từ FK). */
const NO_ACCOUNT_CODES = new Set(['P0002', '23503'])

/** Phần tối thiểu của SupabaseClient mà hàm cần — tiêm giả được trong test. */
export type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>
}

export async function ingestParsed(
  db: RpcClient, tx: ParsedTransaction, refs: Refs, userId: string, source: string | null,
): Promise<IngestStatus> {
  const { data, error } = await db.rpc('ingest_transaction', {
    p_user: userId, p_tx: tx, p_refs: refs, p_source: source,
  })
  if (error && NO_ACCOUNT_CODES.has(error.code ?? '')) return { status: 'no_account' }
  if (error) throw new Error(`ingest_transaction ${error.code ?? ''}: ${error.message}`)
  const res = data as IngestStatus | null
  if (res?.status === 'inserted' || res?.status === 'held' || res?.status === 'held_full') return res
  // Trạng thái lạ = hợp đồng RPC đã đổi: lỗi to còn hơn coi nhầm là đã ghi.
  throw new Error(`ingest_transaction trả trạng thái lạ: ${JSON.stringify(data)}`)
}
