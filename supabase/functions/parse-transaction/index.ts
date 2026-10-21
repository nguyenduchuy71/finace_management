// supabase/functions/parse-transaction/index.ts
//
// Nhận text thô từ Shortcuts, tự nhận diện ngân hàng, bóc tách dữ liệu,
// resolve thẻ/tài khoản, và insert vào bảng `transactions`.
//
// Deploy: supabase functions deploy parse-transaction
// Gọi từ Shortcuts: POST { "text": "<nội dung notification>", "source": "<tên bank>" }
//   header bắt buộc: x-shortcut-secret. `source` tuỳ chọn — xem docs/ios-shortcut-setup.md
//
// Luồng: OTP? -> trùng? -> regex parser -> (không khớp) unparsed_messages

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parsers } from './parsers.ts'
import { parseOwnerNames, withKind } from './internal-transfer.ts'
import { normalizeInput } from './helpers.ts'
import type { ParsedTransaction } from './types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Shortcut trên iOS không cầm được JWT của user -> dùng shared secret.
//
// KHÔNG có rate limit ở tầng function: edge function chạy nhiều instance ngắn hạn,
// đếm trong bộ nhớ không đáng tin (mỗi instance đếm riêng, restart là mất).
// Nếu cần chống flood thật thì đặt ở tầng trước (Cloudflare/WAF) hoặc đếm bằng
// bảng Postgres. Với app cá nhân (vài chục request/ngày, secret 256-bit) thì
// chấp nhận rủi ro này.
const SHORTCUT_SECRET = Deno.env.get('SHORTCUT_SECRET')
// App single-user: mọi giao dịch thuộc về user này.
// BẮT BUỘC có, nếu không row sẽ vô hình sau khi bật RLS.
const DEFAULT_USER_ID = Deno.env.get('DEFAULT_USER_ID')
// Tên chủ TK (phân tách ";") để nhận diện chuyển nội bộ — xem internal-transfer.ts.
// Không set -> mọi giao dịch là 'normal' (chỉ thiếu nhãn, không sai số tiền).
const OWNER_NAMES = parseOwnerNames(Deno.env.get('OWNER_NAMES'))

/** Thông báo ngân hàng thật < 500 ký tự. Xem lý do ở chỗ dùng bên dưới. */
const MAX_TEXT_LENGTH = 2000
const MAX_SOURCE_LENGTH = 50

/** Shortcut gửi lại / automation chạy 2 lần trong khoảng này -> coi là trùng. */
const DEDUP_WINDOW_MS = 10 * 60_000

/**
 * So sánh secret theo thời gian hằng định.
 *
 * `!==` trên chuỗi thoát ngay tại byte đầu khác nhau -> về lý thuyết là oracle đo
 * thời gian từng byte. Qua Internet thì nhiễu che gần hết tín hiệu, nhưng đây là
 * sửa vài dòng nên không có lý do giữ `!==`.
 *
 * Hash SHA-256 trước rồi XOR toàn bộ 32 byte: vòng lặp luôn chạy đủ số vòng nên
 * thời gian không phụ thuộc vị trí byte khác nhau, và độ dài secret cũng không rò
 * (mọi input đều thành 32 byte). `crypto.subtle.timingSafeEqual` KHÔNG tồn tại
 * trong Deno 2.1.4 (đã kiểm tra runtime: undefined) nên tự so sánh.
 */
async function secretMatches(received: string | null, expected: string): Promise<boolean> {
  if (received === null) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(received)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

/**
 * Tìm account_id / card_id từ (bank_name, account_ref).
 * Không khớp -> trả {} để insert với FK null. LƯU Ý: row FK null KHÔNG hiện
 * trong danh sách giao dịch (mọi query đều lọc theo account_id/card_id).
 * Dùng getUnlinkedCount() ở frontend để phát hiện.
 */
async function resolveRefs(
  p: ParsedTransaction,
  userId: string,
): Promise<{ account_id?: string; card_id?: string }> {
  if (!p.account_ref) return {}

  const isBank = p.source_type === 'bank'
  const table = isBank ? 'accounts' : 'credit_cards'
  const column = isBank ? 'account_number' : 'card_number'

  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('bank_name', p.bank_name)
    .like(column, `%${escapeLike(p.account_ref)}`)
    .maybeSingle()

  if (!data) return {}
  return isBank ? { account_id: data.id } : { card_id: data.id }
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
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('raw_text', text)
    .gte('created_at', new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
    .limit(1)
  return (data?.length ?? 0) > 0
}

/** Ghi giao dịch + resolve FK. Trả response cho Shortcut. */
async function insertTx(parsed: ParsedTransaction, userId: string): Promise<Response> {
  const refs = await resolveRefs(parsed, userId)
  const { error } = await supabase
    .from('transactions')
    .insert({ ...parsed, ...refs, user_id: userId })
  if (error) throw error

  // KHÔNG vọng `raw_text` về response: nó chứa nguyên văn thông báo
  // (số TK, số dư, tên người chuyển). Chỉ trả field cần cho Shortcut debug.
  const inserted = { ...parsed, ...refs } as Record<string, unknown>
  delete inserted.raw_text
  return json({ inserted }, 201)
}

/** Lưu tin không ghi được thành giao dịch — nguồn mẫu để viết regex parser mới. */
async function saveUnparsed(text: string, source: string | null, reason: string) {
  // user_id bắt buộc (NOT NULL từ migration 20261021100000) — tin hiện trong hộp
  // "Chưa phân loại" của user. Lỗi không chặn response cho Shortcut nhưng phải lộ
  // ra log: trước đây bị nuốt im lặng, mất luôn mẫu để viết parser.
  const { error } = await supabase
    .from('unparsed_messages')
    .insert({ raw_text: text, source, reason, user_id: DEFAULT_USER_ID })
  if (error) console.error('saveUnparsed failed', error.code, error.message)
}

serve(async (req) => {
  try {
    if (!SHORTCUT_SECRET || !DEFAULT_USER_ID) {
      return json({ error: 'server misconfigured: missing env' }, 500)
    }
    if (!(await secretMatches(req.headers.get('x-shortcut-secret'), SHORTCUT_SECRET))) {
      return json({ error: 'unauthorized' }, 401)
    }

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

    // Bỏ qua tin nhắn OTP / bảo mật, không phải giao dịch thật.
    // Bao phủ mọi biến thể dấu của "ma xac thuc" (a/á/à/ả/ã/ạ, u/ư/ứ/ừ/ự...):
    // bản cũ chỉ có dạng không dấu nên OTP tiếng Việt có dấu lọt xuống nhánh
    // no_match và bị lưu NGUYÊN VĂN cả mã còn hiệu lực vào `unparsed_messages`.
    if (/OTP|m[aáàảãạ]\s*x[aáàảãạ]c\s*th[uưúùủũụứừửữự]c/i.test(text)) {
      return json({ skipped: 'otp_or_security' }, 200)
    }

    if (await isDuplicate(text, DEFAULT_USER_ID)) {
      return json({ skipped: 'duplicate' }, 200)
    }

    for (const parser of parsers) {
      const parsed = parser(text)
      if (!parsed) continue

      // Regex có thể khớp nhưng cho ra dữ liệu vô nghĩa (NaN amount, ngày không hợp lệ).
      // Chặn ở đây để không ghi rác vào DB — trả 422 thay vì để Postgres báo 500.
      if (!Number.isFinite(parsed.amount) || Number.isNaN(Date.parse(parsed.transaction_date))) {
        await saveUnparsed(text, source, 'invalid_parse')
        return json({ skipped: 'invalid_parse', bank: parsed.bank_name }, 422)
      }
      return await insertTx(withKind(parsed, OWNER_NAMES), DEFAULT_USER_ID)
    }

    // Không khớp bank nào -> lưu lại để bổ sung parser sau.
    // Đây là NGUỒN DỮ LIỆU để viết parser cho bank còn thiếu: query bảng này
    // lấy raw_text thật rồi thêm test case vào parsers.test.ts.
    await saveUnparsed(text, source, 'no_match')
    return json({ skipped: 'no_match' }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
