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
// Chạy lại nhiều lần an toàn: tin đã resolved bị bỏ qua; nếu giao dịch cùng raw_text đã
// tồn tại (lần trước insert xong nhưng update tin lỗi) thì liên kết thay vì insert lần 2.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeInput } from './helpers.ts'
import { parseOwnerNames } from './internal-transfer.ts'
import { classifyUnparsed } from './classify-unparsed.ts'
import { insertTransaction, parseNotification, resolveRefs } from './ingest.ts'

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

const stats = { total: rows.length, inserted: 0, linkedExisting: 0, waitingAccount: 0, reclassified: {} as Record<string, number> }
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
  if (existing) stats.linkedExisting++
  else stats.inserted++
  if (!apply) continue

  const txId = existing ?? await insertTransaction(db, tx, refs, r.user_id)
  await update(r.id, {
    resolved: true, kind: tx.kind ?? 'normal', transaction_id: txId, suggested_kind: 'transaction',
  })
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

async function findExisting(userId: string, rawText: string): Promise<string | null> {
  const { data, error } = await db
    .from('transactions').select('id').eq('user_id', userId).eq('raw_text', rawText).limit(1)
  if (error) throw error
  return data[0]?.id ?? null
}
