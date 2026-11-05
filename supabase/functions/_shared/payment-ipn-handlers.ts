// Handler IPN của MoMo + callback của ZaloPay (verify_jwt = false: provider không gửi JWT của Supabase).
// Thứ tự BẮT BUỘC: cấu hình bật -> parse -> kiểm chữ ký -> MỚI chạm DB. Chữ ký sai không đổi DB, không ghi log DB
// (ai cũng gửi được request rác; ghi DB mỗi request rác là mở đường làm đầy bảng) — chỉ console.warn.
// Response cho provider không chứa chi tiết lỗi.

import type { PaymentConfig } from './payment-config.ts'
import { jsonResponse, readJsonBody } from './http.ts'
import * as momo from './momo.ts'
import { settle } from './payment-settle.ts'
import type { PaymentDb } from './payment-types.ts'
import * as zalopay from './zalopay.ts'

export interface IpnDeps { db: PaymentDb; cfg: PaymentConfig | null }

/** Body IPN thật chỉ vài trăm byte. */
const MAX_BODY = 16_000

const empty = (status: number) => new Response(null, { status })

/** MoMo IPN: 204 = đã ghi (mọi kết quả, kể cả mismatch/duplicate); 400 = chữ ký/đối tác sai; 500 = lỗi DB (MoMo gọi lại). */
export async function handleMomoIpn(req: Request, { db, cfg }: IpnDeps): Promise<Response> {
  if (req.method !== 'POST') return empty(405)
  if (!cfg?.momo) return empty(503)
  const body = await readJsonBody(req, MAX_BODY)
  if (!body.ok) return empty(body.status)
  const b = body.value as Record<string, unknown> | null
  if (!b || typeof b !== 'object' || Array.isArray(b) || !(await momo.verifyIpn(b, cfg.momo))) {
    console.warn('momo ipn: chữ ký/partnerCode không hợp lệ')
    return empty(400)
  }
  try {
    await settle(db, 'momo', momo.ipnOutcome(b), 'ipn', b)
    return empty(204)
  } catch (e) {
    console.error('momo ipn', String(e))
    return empty(500)
  }
}

/** ZaloPay callback: return_code 1 = đã ghi, -1 = MAC/dữ liệu sai, 0 = lỗi DB (ZaloPay gọi lại tối đa 3 lần). */
export async function handleZaloPayCallback(req: Request, { db, cfg }: IpnDeps): Promise<Response> {
  const reply = (code: number, message: string, status = 200) => jsonResponse({ return_code: code, return_message: message }, status)
  if (req.method !== 'POST') return empty(405)
  if (!cfg?.zalopay) return empty(503)
  const body = await readJsonBody(req, MAX_BODY)
  const cb = body.ok ? zalopay.asCallbackBody(body.value) : null
  if (!cb || !(await zalopay.verifyCallback(cb, cfg.zalopay))) {
    console.warn('zalopay callback: MAC không hợp lệ')
    return reply(-1, 'mac not equal')
  }
  const outcome = zalopay.callbackOutcome(cb.data, cfg.zalopay)
  if (!outcome) return reply(-1, 'invalid data')
  try {
    // Payload log = `data` đã parse (không có mac).
    await settle(db, 'zalopay', outcome, 'ipn', JSON.parse(cb.data))
    return reply(1, 'success')
  } catch (e) {
    console.error('zalopay callback', String(e))
    return reply(0, 'retry')
  }
}
