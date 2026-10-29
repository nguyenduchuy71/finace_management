// Hành động list_orders / resolve_order của function `admin`.
// Chạy: docker run --rm -v "$PWD/supabase/functions:/f" -w /f/admin denoland/deno:2.1.4 test --allow-all
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { requireAdmin, type GoTrueUser } from './admin-auth.ts'
import { handleAction, type AdminDeps, type AuthUser, type RpcResult } from './admin-actions.ts'

const ADMIN = '99999999-0000-4000-a000-000000000009'
const A = 'aaaaaaaa-0000-4000-a000-000000000001'
const ORDER = 'eeeeeeee-0000-4000-a000-0000000000e1'
const users: AuthUser[] = [{ id: A, email: 'an@x.vn', created_at: '2026-10-01T00:00:00Z', app_metadata: {} }]
const row = {
  id: ORDER, user_id: A, provider: 'momo', provider_order_ref: '261030_abcdef123456', provider_tx_id: 'TX1',
  amount_vnd: 50000, credits: 500, status: 'mismatch',
  created_at: '2026-10-30T01:00:00+00:00', paid_at: null, last_checked_at: null,
}

function setup(results: Record<string, RpcResult> = {}) {
  const calls: { fn: string; params: Record<string, unknown> }[] = []
  const deps: AdminDeps = {
    listAuthUsers: () => Promise.resolve(users),
    getAuthUser: (id) => Promise.resolve(users.find((u) => u.id === id) ?? null),
    setBan: () => Promise.resolve(),
    rpc: (fn, params) => {
      calls.push({ fn, params })
      return Promise.resolve(results[fn] ?? { data: [], error: null })
    },
  }
  return { deps, calls }
}

const err = (code: string): RpcResult => ({ data: null, error: { code, message: 'internal detail' } })

Deno.test('list_orders: truyền bộ lọc + limit 100, ghép email, camelCase, không có pay_url', async () => {
  const { deps, calls } = setup({ admin_list_orders: { data: [row, { ...row, id: 'x', user_id: 'gone' }], error: null } })
  const res = await handleAction(deps, ADMIN, { action: 'list_orders', status: 'mismatch', provider: 'momo', userId: A })
  assertEquals(calls, [{ fn: 'admin_list_orders', params: { p_status: 'mismatch', p_provider: 'momo', p_user: A, p_limit: 100 } }])
  const orders = (res.body as { orders: Record<string, unknown>[] }).orders
  assertEquals(orders[0], {
    id: ORDER, userId: A, email: 'an@x.vn', provider: 'momo', providerOrderRef: '261030_abcdef123456', providerTxId: 'TX1',
    amountVnd: 50000, credits: 500, status: 'mismatch', createdAt: row.created_at, paidAt: null, lastCheckedAt: null,
  })
  assertEquals(orders[1].email, null)
  assertEquals(JSON.stringify(res.body).includes('pay_url'), false)
})

Deno.test('list_orders: không lọc -> tham số null', async () => {
  const { deps, calls } = setup()
  assertEquals((await handleAction(deps, ADMIN, { action: 'list_orders' })).status, 200)
  assertEquals(calls[0].params, { p_status: null, p_provider: null, p_user: null, p_limit: 100 })
})

Deno.test('list_orders: status / provider / userId sai -> 400, không gọi RPC', async () => {
  for (const [body, error] of [
    [{ status: 'hack' }, 'invalid_status'], [{ status: 5 }, 'invalid_status'],
    [{ provider: 'paypal' }, 'invalid_provider'], [{ userId: 'khong-phai-uuid' }, 'invalid_user_id'], [{ userId: 7 }, 'invalid_user_id'],
  ] as const) {
    const { deps, calls } = setup()
    assertEquals(await handleAction(deps, ADMIN, { action: 'list_orders', ...body }), { status: 400, body: { error } })
    assertEquals(calls.length, 0)
  }
})

Deno.test('resolve_order: gọi RPC với admin id + lý do đã trim, trả kết quả', async () => {
  const out = { status: 'paid', credits: 500, balance: 600 }
  const { deps, calls } = setup({ admin_resolve_order: { data: out, error: null } })
  assertEquals(await handleAction(deps, ADMIN, { action: 'resolve_order', orderId: ORDER, option: 'mark_paid', reason: '  da doi chieu sao ke ' }),
    { status: 200, body: out })
  assertEquals(calls, [{ fn: 'admin_resolve_order',
    params: { p_admin: ADMIN, p_order: ORDER, p_option: 'mark_paid', p_reason: 'da doi chieu sao ke' } }])
})

Deno.test('resolve_order: orderId / option / lý do sai -> 400, không gọi RPC', async () => {
  const base = { action: 'resolve_order', orderId: ORDER, option: 'mark_failed', reason: 'khach huy giao dich' }
  for (const [patch, error] of [
    [{ orderId: 'x' }, 'invalid_order_id'], [{ orderId: undefined }, 'invalid_order_id'],
    [{ option: 'delete' }, 'invalid_option'], [{ option: undefined }, 'invalid_option'],
    [{ reason: 'abc' }, 'invalid_reason'], [{ reason: 'x'.repeat(501) }, 'invalid_reason'], [{ reason: 12345 }, 'invalid_reason'],
  ] as const) {
    const { deps, calls } = setup()
    assertEquals(await handleAction(deps, ADMIN, { ...base, ...patch }), { status: 400, body: { error } })
    assertEquals(calls.length, 0)
  }
})

Deno.test('resolve_order: lỗi RPC -> mã HTTP, không lộ message gốc', async () => {
  const body = { action: 'resolve_order', orderId: ORDER, option: 'mark_paid', reason: 'da doi chieu sao ke' }
  for (const [code, status, error] of [
    ['P0002', 404, 'order_not_found'], ['55000', 409, 'order_not_resolvable'],
    ['42501', 400, 'cannot_target_self'], ['23514', 400, 'invalid_reason'], ['XX000', 500, 'internal_error'],
  ] as const) {
    const { deps } = setup({ admin_resolve_order: err(code) })
    assertEquals(await handleAction(deps, ADMIN, body), { status, body: { error } })
  }
})

// ===== Cổng: index.ts chạy requireAdmin TRƯỚC handleAction cho mọi action (kể cả 2 action mới).
const jwt = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`
const getUser = (user: GoTrueUser) => () => Promise.resolve({ data: { user }, error: null })

Deno.test('cổng: user thường -> 403 forbidden, admin chưa MFA -> 403 mfa_required (trước khi tới list/resolve_order)', async () => {
  assertEquals(await requireAdmin(jwt({ aal: 'aal2' }), getUser({ id: A, app_metadata: {} })),
    { ok: false, status: 403, error: 'forbidden' })
  assertEquals(await requireAdmin(jwt({ aal: 'aal1' }), getUser({ id: ADMIN, app_metadata: { role: 'admin' } })),
    { ok: false, status: 403, error: 'mfa_required' })
})
