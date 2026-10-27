// supabase/functions/parse-transaction/index.ts
//
// Nhận text thô từ Shortcuts, tự nhận diện ngân hàng, bóc tách dữ liệu,
// resolve thẻ/tài khoản, và insert vào bảng `transactions`.
//
// Deploy: supabase functions deploy parse-transaction
// Gọi từ Shortcuts: POST { "text": "<nội dung notification>", "source": "<tên bank>" }
//   header: Authorization: Bearer vj_… (API key của user, tạo ở trang Cài đặt).
//   Legacy x-shortcut-secret (single-tenant) còn nhận tới phase 4. `source` tuỳ chọn —
//   xem docs/ios-shortcut-setup.md
//
// Luồng: xác thực key -> OTP? -> trùng? -> regex parser -> (không khớp) unparsed_messages + gợi ý loại

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseOwnerNames } from './internal-transfer.ts'
import { normalizeInput } from './helpers.ts'
import { resolveCaller } from './api-key-auth.ts'
import { classifyUnparsed } from './classify-unparsed.ts'
import { insertTransaction, isOtp, parseNotification, resolveRefs } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Shortcut trên iOS không cầm được JWT của user -> API key riêng của từng user.
// Rate limit đếm ở Postgres (authenticate_api_key), không đếm trong bộ nhớ: edge
// function chạy nhiều instance ngắn hạn, mỗi instance đếm riêng, restart là mất.
//
// LEGACY single-tenant (gỡ ở phase 4): secret chung -> mọi giao dịch thuộc
// DEFAULT_USER_ID, tên chủ TK (phân tách ";") lấy từ env OWNER_NAMES. Chỉ chạy khi
// có cả SHORTCUT_SECRET và DEFAULT_USER_ID. User qua API key dùng
// user_settings.owner_names thay cho env này.
const LEGACY = {
  secret: Deno.env.get('SHORTCUT_SECRET'),
  userId: Deno.env.get('DEFAULT_USER_ID'),
  ownerNames: parseOwnerNames(Deno.env.get('OWNER_NAMES')),
}

/** Bao RPC authenticate_api_key (chỉ service role gọi được) cho resolveCaller. */
const authenticate = (keyHashHex: string) =>
  supabase.rpc('authenticate_api_key', { p_key_hash: keyHashHex })

/** Thông báo ngân hàng thật < 500 ký tự. Xem lý do ở chỗ dùng bên dưới. */
const MAX_TEXT_LENGTH = 2000
const MAX_SOURCE_LENGTH = 50

/** Shortcut gửi lại / automation chạy 2 lần trong khoảng này -> coi là trùng. */
const DEDUP_WINDOW_MS = 10 * 60_000

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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
 * Ghi giao dịch + resolve FK. Chưa có TK/thẻ khớp -> KHÔNG ghi giao dịch mồ côi (dashboard
 * đếm, danh sách không hiện) mà đưa vào hộp tin; tạo TK rồi chạy backfill-unparsed.ts.
 */
async function insertTx(
  parsed: ParsedTransaction, userId: string, source: string | null,
): Promise<Response> {
  const refs = await resolveRefs(supabase, parsed, userId)
  if (!refs.account_id && !refs.card_id) {
    await saveUnparsed(parsed.raw_text, source, 'no_account', userId, 'transaction')
    return json({ skipped: 'no_account', bank: parsed.bank_name, account_ref: parsed.account_ref }, 200)
  }
  await insertTransaction(supabase, parsed, refs, userId)

  // KHÔNG vọng `raw_text` về response: nó chứa nguyên văn thông báo
  // (số TK, số dư, tên người chuyển). Chỉ trả field cần cho Shortcut debug.
  const inserted = { ...parsed, ...refs } as Record<string, unknown>
  delete inserted.raw_text
  return json({ inserted }, 201)
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

serve(async (req) => {
  try {
    const auth = await resolveCaller(req.headers, authenticate, LEGACY)
    if (!auth.ok) return json({ error: auth.error }, auth.status)
    const { userId, ownerNames } = auth.caller

    const body = await req.json()
    const text = typeof body?.text === 'string' ? normalizeInput(body.text) : ''
    if (!text) {
      return json({ error: 'missing text' }, 400)
    }
    // Tên bank do automation gắn cứng (mỗi app 1 automation). Chỉ lưu kèm
    // unparsed_messages để biết tin lạ đến từ app nào khi viết parser mới —
    // bank_name của giao dịch do parser tự đặt, không lấy từ đây.
    const source = typeof body?.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, MAX_SOURCE_LENGTH)
      : null

    // Chặn payload dài TRƯỚC khi chạy parser.
    //
    // Parser SHB dùng lazy scan không neo `(?:.*?)` -> độ phức tạp O(N²): đo thật
    // 203KB = 8.665ms, 102KB = 2.744ms (gấp đôi input, gấp 4 thời gian). Regex trong
    // Deno chạy đồng bộ không nhường CPU -> vài request lớn là edge worker đứng hình.
    // Thông báo ngân hàng thật < 500 ký tự; cap 2000 đưa worst case về 3.5ms.
    if (text.length > MAX_TEXT_LENGTH) {
      return json({ error: 'text too long', max: MAX_TEXT_LENGTH }, 413)
    }

    // OTP / bảo mật: không phải giao dịch và KHÔNG lưu (mã còn hiệu lực).
    if (isOtp(text)) {
      return json({ skipped: 'otp_or_security' }, 200)
    }

    if (await isDuplicate(text, userId)) {
      return json({ skipped: 'duplicate' }, 200)
    }

    const outcome = parseNotification(text, ownerNames)
    if (outcome.status === 'parsed') {
      return await insertTx(outcome.tx, userId, source)
    }
    // Regex khớp nhưng ra dữ liệu vô nghĩa -> không ghi rác vào DB, trả 422
    // thay vì để Postgres báo 500.
    if (outcome.status === 'invalid') {
      await saveUnparsed(text, source, 'invalid_parse', userId)
      return json({ skipped: 'invalid_parse', bank: outcome.bank }, 422)
    }

    // Không khớp bank nào -> lưu lại để bổ sung parser sau.
    // Đây là NGUỒN DỮ LIỆU để viết parser cho bank còn thiếu: query bảng này
    // lấy raw_text thật rồi thêm test case vào parsers.test.ts.
    await saveUnparsed(text, source, 'no_match', userId)
    return json({ skipped: 'no_match' }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
