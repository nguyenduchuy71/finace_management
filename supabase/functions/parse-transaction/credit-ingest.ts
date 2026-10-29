// Ghi giao dịch + trừ credit trong MỘT lệnh DB (RPC ingest_transaction, chỉ service_role gọi được).
// Dùng chung cho edge function (persist.ts) và script backfill-unparsed.ts: không còn đường nào
// insert giao dịch tự động mà không qua credit.

import type { Refs } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

/** inserted: đã ghi + trừ 1 credit | held: hết credit, tin giữ ở hộp tin (reason no_credit) | held_full: trần tin treo. */
export type IngestStatus =
  | { status: 'inserted'; id: string }
  | { status: 'held'; id: string }
  | { status: 'held_full' }

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
  if (error) throw new Error(`ingest_transaction ${error.code ?? ''}: ${error.message}`)
  const res = data as IngestStatus | null
  if (res?.status === 'inserted' || res?.status === 'held' || res?.status === 'held_full') return res
  // Trạng thái lạ = hợp đồng RPC đã đổi: lỗi to còn hơn coi nhầm là đã ghi.
  throw new Error(`ingest_transaction trả trạng thái lạ: ${JSON.stringify(data)}`)
}
