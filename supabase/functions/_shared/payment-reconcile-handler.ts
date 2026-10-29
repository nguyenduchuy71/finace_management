// payment-reconcile (verify_jwt = false + header x-reconcile-secret): hỏi provider về đơn pending cũ rồi hết hạn đơn quá hạn.
// Gọi bởi scheduler ngoài (Supabase Cron / GitHub Actions / cron máy chủ) mỗi ~5 phút — xem docs/claude/edge-functions.md.

import { secretMatches } from '../parse-transaction/shortcut-auth.ts'
import { jsonResponse } from './http.ts'
import type { PaymentConfig } from './payment-config.ts'
import { reconcileOrder } from './payment-settle.ts'
import type { FetchFn, OrderRow, PaymentDb } from './payment-types.ts'

export interface ReconcileDeps { db: PaymentDb; cfg: PaymentConfig | null; fetchFn: FetchFn; secret: string | undefined }

/** Chỉ đối soát đơn đã chờ quá ngần này (IPN bình thường tới trước). */
export const MIN_AGE_S = 120
export const BATCH_LIMIT = 50
const CONCURRENCY = 5

export async function handleReconcile(req: Request, d: ReconcileDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)
  if (!d.secret) return jsonResponse({ error: 'disabled' }, 503)
  if (!(await secretMatches(req.headers.get('x-reconcile-secret'), d.secret))) return jsonResponse({ error: 'unauthorized' }, 401)
  if (!d.cfg) return jsonResponse({ error: 'provider_disabled' }, 503)
  try {
    const { data, error } = await d.db.rpc('list_orders_to_reconcile', { p_min_age_s: MIN_AGE_S, p_limit: BATCH_LIMIT })
    if (error) throw new Error(error.message)
    const orders = (data as OrderRow[] | null) ?? []
    const counts: Record<string, number> = {}
    for (let i = 0; i < orders.length; i += CONCURRENCY) {
      const results = await Promise.all(orders.slice(i, i + CONCURRENCY).map((o) => reconcileOrder(d.db, o, d.cfg as PaymentConfig, d.fetchFn)))
      for (const r of results) counts[r] = (counts[r] ?? 0) + 1
    }
    const exp = await d.db.rpc('expire_stale_orders')
    if (exp.error) throw new Error(exp.error.message)
    return jsonResponse({ checked: orders.length, results: counts, expired: exp.data }, 200)
  } catch (e) {
    console.error('payment-reconcile', String(e))
    return jsonResponse({ error: 'internal_error' }, 500)
  }
}
