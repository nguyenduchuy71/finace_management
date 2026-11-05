// resolve-unparsed (verify_jwt = true): phân loại thủ công 1 tin ở hộp "Chưa phân loại".
// Tạo giao dịch TỐN 1 credit (RPC resolve_unparsed_charged, chỉ service_role): web không còn ghi giao dịch trực tiếp.
// User lấy từ JWT (getUser), KHÔNG nhận user_id từ body. Mọi kiểm hợp đồng p_tx (số tiền, ngày, category, TK/thẻ của user)
// nằm ở RPC; handler chỉ chặn hình dạng body và chuyển lỗi sang HTTP.

import { CORS_HEADERS as CORS, jsonResponse, readJsonBody } from '../_shared/http.ts'

export type RpcResult = { data: unknown; error: { code?: string; message: string } | null }

export interface ResolveDeps {
  /** id user từ JWT hợp lệ, hoặc null. */
  authenticate: (req: Request) => Promise<string | null>
  rpc: (fn: string, params: Record<string, unknown>) => PromiseLike<RpcResult>
}

const MAX_BODY = 4_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS = new Set(['normal', 'internal_transfer', 'cashback', 'card_reminder', 'promo'])
/** Chỉ các trường RPC đọc; trường lạ bị bỏ để body không "lái" RPC. */
const TX_FIELDS = ['amount', 'transaction_date', 'description', 'merchant_name', 'category', 'account_id', 'card_id'] as const

const json = (body: unknown, status: number) => jsonResponse(body, status, CORS)

/** Lỗi RPC -> [HTTP, mã]. Không trả message gốc (lộ tên bảng/ràng buộc). */
const RPC_ERRORS: Record<string, [number, string]> = {
  '22003': [402, 'insufficient_credit'],
  '42501': [403, 'suspended'],
  P0002: [404, 'not_found'],
  '22023': [400, 'invalid_request'],
  '23503': [409, 'account_gone'],
}

function pickTx(v: unknown): Record<string, unknown> | null | undefined {
  if (v === undefined || v === null) return null
  if (typeof v !== 'object' || Array.isArray(v)) return undefined
  const src = v as Record<string, unknown>
  return Object.fromEntries(TX_FIELDS.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]))
}

export async function handleResolveUnparsed(req: Request, d: ResolveDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    const user = await d.authenticate(req)
    if (!user) return json({ error: 'unauthorized' }, 401)

    const body = await readJsonBody(req, MAX_BODY)
    if (!body.ok) return json({ error: body.error }, body.status)
    const b = body.value as Record<string, unknown> | null
    if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ error: 'invalid_request' }, 400)
    const tx = pickTx(b.tx)
    if (typeof b.message_id !== 'string' || !UUID_RE.test(b.message_id)
        || typeof b.kind !== 'string' || !KINDS.has(b.kind) || tx === undefined) {
      return json({ error: 'invalid_request' }, 400)
    }

    const { data, error } = await d.rpc('resolve_unparsed_charged', {
      p_user: user, p_msg_id: b.message_id, p_kind: b.kind, p_tx: tx,
    })
    if (error) {
      const [status, code] = RPC_ERRORS[error.code ?? ''] ?? [500, 'internal_error']
      if (status === 500) console.error('resolve_unparsed_charged', error.code, error.message)
      return json({ error: code }, status)
    }
    return json({ transaction_id: typeof data === 'string' ? data : null }, 200)
  } catch (e) {
    console.error('resolve-unparsed', String(e))
    return json({ error: 'internal_error' }, 500)
  }
}
