// create-payment (verify_jwt = true): GET danh sách ví đang bật; POST {action:'create'|'refresh'}.
// User lấy từ JWT (getUser), KHÔNG nhận user_id / URL từ body. Credit chỉ cộng ở IPN/đối soát, không ở đây.

import { enabledProviders, type PaymentConfig, type PaymentProvider } from './payment-config.ts'
import { CORS_HEADERS as CORS, jsonResponse, readJsonBody } from './http.ts'
import { createPayUrl } from './payment-gateway.ts'
import { logEvent, reconcileOrder } from './payment-settle.ts'
import type { FetchFn, OrderRow, PaymentDb } from './payment-types.ts'

export interface CreateDeps {
  db: PaymentDb
  cfg: PaymentConfig | null
  fetchFn: FetchFn
  nowMs: () => number
  /** id user từ JWT hợp lệ, hoặc null. */
  authenticate: (req: Request) => Promise<string | null>
}

/** Không đối soát lại 1 đơn quá thường: trang return poll 3s/lần nhưng chỉ cứ 15s mới hỏi provider. */
export const MIN_REFRESH_GAP_MS = 15_000
const MAX_BODY = 2_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const json = (body: unknown, status: number) => jsonResponse(body, status, CORS)
const isProvider = (v: unknown): v is PaymentProvider => v === 'momo' || v === 'zalopay'

async function getOrder(db: PaymentDb, id: string, user: string): Promise<OrderRow | null> {
  const { data, error } = await db.rpc('get_payment_order', { p_order: id, p_user: user })
  if (error) throw new Error(error.message)
  return (data as OrderRow[] | null)?.[0] ?? null
}

async function createOrder(user: string, b: Record<string, unknown>, d: CreateDeps): Promise<Response> {
  if (!isProvider(b.provider) || typeof b.package_id !== 'string' || b.package_id.length > 40) return json({ error: 'invalid_request' }, 400)
  if (!enabledProviders(d.cfg).includes(b.provider)) return json({ error: 'provider_disabled' }, 503)
  const cfg = d.cfg as PaymentConfig

  const { data, error } = await d.db.rpc('create_payment_order', { p_user: user, p_provider: b.provider, p_package_id: b.package_id })
  if (error) {
    // Provider đã kiểm ở trên -> 22023 ở đây là chạm giới hạn đơn đang chờ.
    const map: Record<string, [number, string]> = { P0002: [404, 'package_not_found'], '22023': [429, 'too_many_pending'], '42501': [403, 'suspended'] }
    const [status, code] = map[error.code ?? ''] ?? [500, 'internal_error']
    if (status === 500) console.error('create_payment_order', error.message)
    return json({ error: code }, status)
  }
  const order = data as OrderRow

  let payUrl: string | null = null
  try {
    payUrl = await createPayUrl(order, cfg, d.fetchFn, d.nowMs())
  } catch (e) {
    console.error('create-payment provider', order.provider, String(e))
  }
  if (!payUrl) {
    await d.db.rpc('fail_payment_order', { p_provider: order.provider, p_order_ref: order.provider_order_ref, p_reason: 'create_failed' })
    await logEvent(d.db, order.provider, order.provider_order_ref, null, 'create', 'provider_error', {})
    return json({ error: 'provider_error' }, 502)
  }
  await d.db.rpc('set_order_pay_url', { p_order: order.id, p_pay_url: payUrl })
  await logEvent(d.db, order.provider, order.provider_order_ref, null, 'create', 'ok', {})
  return json({ order_id: order.id, pay_url: payUrl }, 200)
}

async function refreshOrder(user: string, b: Record<string, unknown>, d: CreateDeps): Promise<Response> {
  if (typeof b.order_id !== 'string' || !UUID_RE.test(b.order_id)) return json({ error: 'invalid_request' }, 400)
  const order = await getOrder(d.db, b.order_id, user)
  if (!order) return json({ error: 'not_found' }, 404)

  const age = order.last_checked_at ? d.nowMs() - Date.parse(order.last_checked_at) : Infinity
  if (order.status === 'pending' && age >= MIN_REFRESH_GAP_MS && d.cfg) {
    await reconcileOrder(d.db, order, d.cfg, d.fetchFn)
    await d.db.rpc('expire_stale_orders')
    return json({ status: (await getOrder(d.db, order.id, user))?.status ?? order.status }, 200)
  }
  return json({ status: order.status }, 200)
}

export async function handleCreatePayment(req: Request, d: CreateDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    const user = await d.authenticate(req)
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (req.method === 'GET') return json({ providers: enabledProviders(d.cfg) }, 200)
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

    const body = await readJsonBody(req, MAX_BODY)
    if (!body.ok) return json({ error: body.error }, body.status)
    const b = body.value as Record<string, unknown> | null
    if (!b || typeof b !== 'object') return json({ error: 'invalid_request' }, 400)
    if (b.action === 'create') return await createOrder(user, b, d)
    if (b.action === 'refresh') return await refreshOrder(user, b, d)
    return json({ error: 'invalid_request' }, 400)
  } catch (e) {
    console.error('create-payment', String(e))
    return json({ error: 'internal_error' }, 500)
  }
}
