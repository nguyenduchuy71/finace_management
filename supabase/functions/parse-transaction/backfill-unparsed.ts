// Chạy lại các tin CHƯA xử lý trong unparsed_messages qua parser + bộ phân loại hiện tại.
// Chạy tay (không deploy), dùng service_role — bỏ qua RLS, nên CHỈ chạy từ máy dev.
//
//   set -a; source .env; set +a      # VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ OWNER_NAMES)
//   docker run --rm --network host --entrypoint deno \
//     -e VITE_SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY -e OWNER_NAMES \
//     -v "$PWD/supabase/functions/parse-transaction:/app" -w /app denoland/deno:2.1.4 \
//     run --allow-net --allow-env backfill-unparsed.ts            # dry-run: chỉ in thống kê
//     ... backfill-unparsed.ts --apply                            # ghi thật
//
// Với mỗi tin resolved = false:
//   - parse được VÀ resolve được TK/thẻ -> tạo giao dịch (ngày theo received_at nếu tin
//     không ghi ngày), đánh dấu resolved + kind + transaction_id.
//   - parse được nhưng CHƯA có TK/thẻ khớp -> giữ trong hộp, suggested_kind = 'transaction'
//     (ghi giao dịch mồ côi thì dashboard đếm mà danh sách không hiện). Tạo TK rồi chạy lại.
//   - không parse được -> chỉ cập nhật suggested_kind.
// Chạy song song với web an toàn: tin bị user xử lý giữa chừng -> xoá giao dịch vừa tạo (lostRace).
// Ghi giao dịch qua RPC ingest_transaction nên TRỪ 1 credit như đường Shortcut; hết credit thì tin giữ nguyên
// trong hộp (stats.noCredit), không tạo thêm tin treo trùng. Giao dịch bị xoá do lostRace được hoàn credit.
// Chạy lại nhiều lần an toàn: tin đã resolved bị bỏ qua; nếu giao dịch cùng raw_text đã
// tồn tại (lần trước insert xong nhưng update tin lỗi) thì liên kết thay vì insert lần 2.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeInput } from './helpers.ts'
import { parseOwnerNames } from './internal-transfer.ts'
import { classifyUnparsed } from './classify-unparsed.ts'
import { ingestParsed } from './credit-ingest.ts'
import { parseNotification, resolveRefs } from './ingest.ts'

const url = Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}
const apply = Deno.args.includes('--apply')
const owners = parseOwnerNames(Deno.env.get('OWNER_NAMES'))
const db = createClient(url, key, { auth: { persistSession: false } })

type Row = { id: string; user_id: string; raw_text: string; received_at: string }

const { data: rows, error } = await db
  .from('unparsed_messages')
  .select('id, user_id, raw_text, received_at')
  .eq('resolved', false)
  .order('received_at')
if (error) throw error

const stats = {
  total: rows.length, inserted: 0, linkedExisting: 0, lostRace: 0, duplicateKept: 0, waitingAccount: 0, noCredit: 0,
  reclassified: {} as Record<string, number>,
}
const waiting: string[] = []

for (const r of rows as Row[]) {
  const text = normalizeInput(r.raw_text)
  const outcome = parseNotification(text, owners, Date.parse(r.received_at))

  if (outcome.status !== 'parsed') {
    const kind = classifyUnparsed(text)
    stats.reclassified[kind] = (stats.reclassified[kind] ?? 0) + 1
    if (apply) await update(r.id, { suggested_kind: kind })
    continue
  }

  const tx = outcome.tx
  const refs = await resolveRefs(db, tx, r.user_id)
  if (!refs.account_id && !refs.card_id) {
    stats.waitingAccount++
    waiting.push(`${tx.bank_name} ${tx.source_type} …${tx.account_ref ?? '?'}`)
    if (apply) await update(r.id, { suggested_kind: 'transaction' })
    continue
  }

  const existing = await findExisting(r.user_id, tx.raw_text)
  // Cùng nội dung đã là giao dịch của TIN KHÁC: có thể là thông báo gửi lặp, có thể là 2 giao
  // dịch thật giống hệt (MoMo không có giờ). Không đoán — để user quyết trong hộp tin.
  if (existing === 'linked_elsewhere') {
    stats.duplicateKept++
    if (apply) await update(r.id, { suggested_kind: 'transaction' })
    continue
  }
  if (!apply) {
    if (existing) stats.linkedExisting++
    else stats.inserted++
    continue
  }

  let inserted: string | null = null
  if (!existing) {
    const res = await ingestParsed(db, tx, refs, r.user_id, null)
    if (res.status !== 'inserted') {
      // Hết credit: ingest_transaction vừa tạo tin treo MỚI cho cùng nội dung — bỏ nó, tin gốc vẫn ở hộp.
      if (res.status === 'held') await removeHeldDuplicate(res.id)
      stats.noCredit++
      continue
    }
    inserted = res.id
  }
  let claimed: boolean
  try {
    claimed = await claimMessage(r.id, {
      resolved: true, kind: tx.kind ?? 'normal', transaction_id: existing ?? inserted, suggested_kind: 'transaction',
    })
  } catch (e) {
    // Update có thể ĐÃ commit dù client nhận lỗi (mạng/timeout) — xoá mù sẽ để lại tin "đã xử lý"
    // mà không còn giao dịch. Chỉ xoá khi tin chắc chắn không trỏ tới giao dịch vừa tạo.
    if (inserted) await removeIfUnlinked(r.id, inserted, r.user_id)
    throw e
  }
  // User xử lý tin này trên web trong lúc script chạy: giao dịch vừa tạo là thừa.
  if (!claimed) {
    if (inserted) await removeTransaction(inserted, r.user_id)
    stats.lostRace++
    continue
  }
  if (existing) stats.linkedExisting++
  else stats.inserted++
}

console.log(apply ? 'ĐÃ GHI' : 'DRY-RUN (thêm --apply để ghi)', JSON.stringify(stats, null, 2))
if (waiting.length) {
  const counts = waiting.reduce<Record<string, number>>((m, w) => ({ ...m, [w]: (m[w] ?? 0) + 1 }), {})
  console.log('Cần tạo TK/thẻ (bank_name khớp, số kết thúc bằng ref) rồi chạy lại:', counts)
}

async function update(id: string, patch: Record<string, unknown>) {
  const { error } = await db.from('unparsed_messages').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Đánh dấu tin CHỈ KHI còn chưa xử lý. Lọc `resolved = false` thay vì update theo id: tin
 * đã được user xử lý thì 0 dòng (trigger guard_unparsed_update không chạy) -> trả false.
 */
async function claimMessage(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db
    .from('unparsed_messages').update(patch).eq('id', id).eq('resolved', false).select('id')
  if (error) throw error
  return data.length > 0
}

/** Xoá giao dịch vừa tạo và hoàn 1 credit nếu nó đã bị trừ (user unlimited không có dòng usage -> không hoàn). */
async function removeTransaction(id: string, userId: string) {
  const { error } = await db.from('transactions').delete().eq('id', id)
  if (error) throw error
  const { data, error: ledgerErr } = await db
    .from('credit_ledger').select('id').eq('kind', 'usage').eq('ref', id).limit(1)
  if (ledgerErr) throw ledgerErr
  if (data.length === 0) return
  const { error: refundErr } = await db.rpc('_apply_credit', {
    p_user: userId, p_delta: 1, p_kind: 'refund', p_ref: id,
  })
  if (refundErr) throw refundErr
}

async function removeHeldDuplicate(id: string) {
  const { error } = await db.from('unparsed_messages').delete().eq('id', id)
  if (error) throw error
}

async function removeIfUnlinked(msgId: string, txId: string, userId: string) {
  const { data, error } = await db.from('unparsed_messages').select('transaction_id').eq('id', msgId).single()
  if (error) throw error
  if (data.transaction_id !== txId) await removeTransaction(txId, userId)
}

/**
 * Giao dịch cùng raw_text CHƯA gắn tin nào (lần chạy trước insert xong nhưng crash trước khi
 * đánh dấu tin) -> id để liên kết lại. Mọi giao dịch cùng nội dung đều đã gắn tin khác ->
 * 'linked_elsewhere' (gắn thêm sẽ vi phạm uq_unparsed_transaction). Không có -> null.
 */
async function findExisting(userId: string, rawText: string): Promise<string | 'linked_elsewhere' | null> {
  const { data: txs, error } = await db
    .from('transactions').select('id').eq('user_id', userId).eq('raw_text', rawText).limit(20)
  if (error) throw error
  if (txs.length === 0) return null
  const ids = txs.map((t) => t.id as string)
  const { data: links, error: linkErr } = await db
    .from('unparsed_messages').select('transaction_id').in('transaction_id', ids)
  if (linkErr) throw linkErr
  const linked = new Set(links.map((l) => l.transaction_id as string))
  return ids.find((id) => !linked.has(id)) ?? 'linked_elsewhere'
}
