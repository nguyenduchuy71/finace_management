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
  const authLookups: string[] = []
  const deps: AdminDeps = {
    listAuthUsers: () => Promise.reject(new Error('list_orders/resolve_order không được liệt kê mọi user')),
    getAuthUser: (id) => {
      authLookups.push(id)
      return Promise.resolve(users.find((u) => u.id === id) ?? null)
    },
    setBan: () => Promise.resolve(),
    rpc: (fn, params) => {
      calls.push({ fn, params })
      return Promise.resolve(results[fn] ?? { data: fn === 'admin_order_owner' ? A : [], error: null })
    },
  }
  return { deps, calls, authLookups }
}

const err = (code: string, message = 'internal detail'): RpcResult => ({ data: null, error: { code, message } })

Deno.test('list_orders: truyền bộ lọc + limit 100, ghép email, camelCase, không có pay_url', async () => {
  const { deps, calls, authLookups } = setup({ admin_list_orders: { data: [row, { ...row, id: 'x', user_id: 'gone' }, { ...row, id: 'y' }], error: null } })
  const res = await handleAction(deps, ADMIN, { action: 'list_orders', status: 'mismatch', provider: 'momo', userId: A })
  assertEquals(calls, [
    { fn: 'admin_list_orders', params: { p_status: 'mismatch', p_provider: 'momo', p_user: A, p_limit: 100 } },
    { fn: 'admin_reconcile_status', params: {} },
  ])
  assertEquals(authLookups, [A, 'gone'])   // mỗi user trong trang đúng 1 lần
  const orders = (res.body as { orders: Record<string, unknown>[] }).orders
  assertEquals(orders[0], {
    id: ORDER, userId: A, email: 'an@x.vn', provider: 'momo', providerOrderRef: '261030_abcdef123456', providerTxId: 'TX1',
    amountVnd: 50000, credits: 500, status: 'mismatch', createdAt: row.created_at, paidAt: null, lastCheckedAt: null,
  })
  assertEquals(orders[1].email, null)
  assertEquals(JSON.stringify(res.body).includes('pay_url'), false)
})

Deno.test('list_orders: kèm trạng thái đối soát (camelCase); RPC trạng thái lỗi -> reconcile null, vẫn trả đơn', async () => {
  const recon = { last_outcome: 'sent', last_at: '2026-10-30T01:00:00+00:00', last_http_status: 200, stale_pending: '2' }
  const okRes = await handleAction(setup({ admin_list_orders: { data: [], error: null }, admin_reconcile_status: { data: [recon], error: null } }).deps,
    ADMIN, { action: 'list_orders' })
  assertEquals((okRes.body as { reconcile: unknown }).reconcile,
    { lastOutcome: 'sent', lastAt: recon.last_at, lastHttpStatus: 200, stalePending: 2 })
  const bad = await handleAction(setup({ admin_list_orders: { data: [], error: null }, admin_reconcile_status: err('42501') }).deps,
    ADMIN, { action: 'list_orders' })
  assertEquals(bad.status, 200)
  assertEquals((bad.body as { reconcile: unknown }).reconcile, null)
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
  assertEquals(await handleAction(deps, ADMIN, {
    action: 'resolve_order', orderId: ORDER, option: 'mark_paid', reason: '  da doi chieu sao ke ', providerTxId: '  TX99 ',
  }), { status: 200, body: out })
  assertEquals(calls, [
    { fn: 'admin_order_owner', params: { p_order: ORDER } },
    { fn: 'admin_resolve_order',
      params: { p_admin: ADMIN, p_order: ORDER, p_option: 'mark_paid', p_reason: 'da doi chieu sao ke', p_provider_tx_id: 'TX99' } },
  ])
})

Deno.test('resolve_order: không có mã giao dịch -> p_provider_tx_id null (RPC quyết định có bắt buộc không)', async () => {
  const { deps, calls } = setup({ admin_resolve_order: { data: {}, error: null } })
  await handleAction(deps, ADMIN, { action: 'resolve_order', orderId: ORDER, option: 'mark_failed', reason: 'khach huy giao dich', providerTxId: '   ' })
  assertEquals(calls[1].params.p_provider_tx_id, null)
})

Deno.test('resolve_order: mã giao dịch sai kiểu / quá 100 ký tự -> 400 invalid_tx_id, không gọi RPC', async () => {
  for (const providerTxId of [123, 'x'.repeat(101), {}]) {
    const { deps, calls } = setup()
    assertEquals(await handleAction(deps, ADMIN, { action: 'resolve_order', orderId: ORDER, option: 'mark_paid', reason: 'da doi chieu sao ke', providerTxId }),
      { status: 400, body: { error: 'invalid_tx_id' } })
    assertEquals(calls.length, 0)
  }
})

Deno.test('resolve_order: đơn của chính admin / của admin khác / không tồn tại -> chặn trước khi gọi admin_resolve_order', async () => {
  const body = { action: 'resolve_order', orderId: ORDER, option: 'mark_paid', reason: 'da doi chieu sao ke', providerTxId: 'TX1' }
  const self = setup({ admin_order_owner: { data: ADMIN, error: null } })
  assertEquals(await handleAction(self.deps, ADMIN, body), { status: 400, body: { error: 'cannot_target_self' } })
  const other = setup()
  users.push({ id: 'bbbbbbbb-0000-4000-a000-00000000000b', email: 'ad2@x.vn', created_at: '2026-10-01T00:00:00Z', app_metadata: { role: 'admin' } })
  const otherAdmin = setup({ admin_order_owner: { data: 'bbbbbbbb-0000-4000-a000-00000000000b', error: null } })
  assertEquals(await handleAction(otherAdmin.deps, ADMIN, body), { status: 400, body: { error: 'cannot_target_admin' } })
  const none = setup({ admin_order_owner: { data: null, error: null } })
  assertEquals(await handleAction(none.deps, ADMIN, body), { status: 404, body: { error: 'order_not_found' } })
  for (const s of [self, otherAdmin, none]) assertEquals(s.calls.some((c) => c.fn === 'admin_resolve_order'), false)
  assertEquals(other.calls.length, 0)
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
    ['23505', 409, 'tx_id_in_use'], ['22023', 400, 'invalid_input'],
    ['23514', 400, 'invalid_reason'], ['XX000', 500, 'internal_error'],
  ] as const) {
    const { deps } = setup({ admin_resolve_order: err(code) })
    assertEquals(await handleAction(deps, ADMIN, body), { status, body: { error } })
  }
  // 42501: chỉ thông điệp "đơn của chính mình" của RPC mới là cannot_target_self; permission denied thật là 500.
  const self = setup({ admin_resolve_order: err('42501', 'không xử lý đơn của chính mình') })
  assertEquals(await handleAction(self.deps, ADMIN, body), { status: 400, body: { error: 'cannot_target_self' } })
  const denied = setup({ admin_resolve_order: err('42501', 'permission denied for table payment_orders') })
  assertEquals(await handleAction(denied.deps, ADMIN, body), { status: 500, body: { error: 'internal_error' } })
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
