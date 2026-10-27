// Chạy: docker run --rm -v "$PWD/supabase/functions:/f" -w /f/admin denoland/deno:2.1.4 test --allow-all
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { bearerToken, requireAdmin, tokenAal, type GoTrueUser } from './admin-auth.ts'
import { handleAction, parseRate, type AdminDeps, type AuthUser, type RpcResult } from './admin-actions.ts'

const ADMIN = '99999999-0000-4000-a000-000000000009'
const A = 'aaaaaaaa-0000-4000-a000-000000000001'
const B = 'bbbbbbbb-0000-4000-a000-000000000002'
const OTHER_ADMIN = 'cccccccc-0000-4000-a000-000000000003'

/** JWT giả chỉ có payload — requireAdmin chỉ đọc aal SAU khi getUser (giả) đã chấp nhận. */
const jwt = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`

const getUser = (user: GoTrueUser | null) => () => Promise.resolve({ data: { user }, error: user ? null : { message: 'bad' } })

// ===== requireAdmin
Deno.test('tokenAal đọc claim aal, token hỏng -> null', () => {
  assertEquals(tokenAal(jwt({ aal: 'aal2' })), 'aal2')
  assertEquals(tokenAal('khong-phai-jwt'), null)
  assertEquals(tokenAal(jwt({})), null)
})

Deno.test('requireAdmin: không token / token sai -> 401', async () => {
  assertEquals(await requireAdmin(null, getUser(null)), { ok: false, status: 401, error: 'unauthorized' })
  assertEquals(await requireAdmin(jwt({ aal: 'aal2' }), getUser(null)), { ok: false, status: 401, error: 'unauthorized' })
})

Deno.test('requireAdmin: user thường (kể cả tự đặt user_metadata.role) -> 403 forbidden', async () => {
  const u = { id: A, app_metadata: {}, user_metadata: { role: 'admin' } } as GoTrueUser
  assertEquals(await requireAdmin(jwt({ aal: 'aal2' }), getUser(u)), { ok: false, status: 403, error: 'forbidden' })
})

Deno.test('requireAdmin: admin chưa MFA (aal1) -> 403 mfa_required', async () => {
  const u = { id: ADMIN, app_metadata: { role: 'admin' } }
  assertEquals(await requireAdmin(jwt({ aal: 'aal1' }), getUser(u)), { ok: false, status: 403, error: 'mfa_required' })
})

Deno.test('requireAdmin: admin aal2 -> ok', async () => {
  const u = { id: ADMIN, app_metadata: { role: 'admin' } }
  assertEquals(await requireAdmin(jwt({ aal: 'aal2' }), getUser(u)), { ok: true, adminId: ADMIN })
})

Deno.test('bearerToken: chỉ nhận "Bearer <token>" (không phân biệt hoa thường), không nhận Basic / hai token', () => {
  const h = (v?: string) => new Headers(v === undefined ? {} : { authorization: v })
  assertEquals(bearerToken(h('Bearer abc.def')), 'abc.def')
  assertEquals(bearerToken(h('bearer abc')), 'abc')
  assertEquals(bearerToken(h('Basic abc')), null)
  assertEquals(bearerToken(h('Bearer a b')), null)
  assertEquals(bearerToken(h('Bearer ')), null)
  assertEquals(bearerToken(h()), null)
})

Deno.test('requireAdmin: GoTrue báo lỗi dù vẫn có user -> 401 (không tin user khi có lỗi)', async () => {
  const u = { id: ADMIN, app_metadata: { role: 'admin' } }
  const res = await requireAdmin(jwt({ aal: 'aal2' }),
    () => Promise.resolve({ data: { user: u }, error: { message: 'jwt expired' } }))
  assertEquals(res, { ok: false, status: 401, error: 'unauthorized' })
})

Deno.test('requireAdmin: admin token không có claim aal -> 403 mfa_required (không mặc định cho qua)', async () => {
  const u = { id: ADMIN, app_metadata: { role: 'admin' } }
  assertEquals(await requireAdmin(jwt({}), getUser(u)), { ok: false, status: 403, error: 'mfa_required' })
})

// ===== handleAction
const authUsers: AuthUser[] = [
  { id: A, email: 'An@x.vn', created_at: '2026-10-01T00:00:00Z', last_sign_in_at: '2026-10-20T00:00:00Z', app_metadata: {} },
  { id: B, email: 'binh@x.vn', created_at: '2026-10-05T00:00:00Z', app_metadata: {} },
  { id: OTHER_ADMIN, email: 'ops@x.vn', created_at: '2026-09-01T00:00:00Z', app_metadata: { role: 'admin' } },
]
const statsA = {
  user_id: A, suspended_at: null, suspended_reason: null, consent_at: '2026-10-01T00:00:00Z',
  keys_active: 1, keys_last_used_at: '2026-10-26T00:00:00Z', tx_count_30d: 9, unparsed_30d: { no_match: 1, no_account: 4 },
}

function fakeDeps(overrides: Partial<AdminDeps> = {}, rpcResults: Record<string, RpcResult> = {}) {
  const calls: { fn: string; params: Record<string, unknown> }[] = []
  const bans: [string, boolean][] = []
  const deps: AdminDeps = {
    listAuthUsers: () => Promise.resolve(authUsers),
    getAuthUser: (id) => Promise.resolve(authUsers.find((u) => u.id === id) ?? null),
    setBan: (id, banned) => { bans.push([id, banned]); return Promise.resolve() },
    rpc: (fn, params) => {
      calls.push({ fn, params })
      return Promise.resolve(rpcResults[fn] ?? { data: fn === 'admin_user_stats' ? [statsA] : [], error: null })
    },
    ...overrides,
  }
  return { deps, calls, bans }
}

Deno.test('parseRate: tx / (tx + no_match + invalid_parse); no_account không tính; chưa có tin -> null', () => {
  assertEquals(parseRate(9, { no_match: 1, no_account: 4 }), 0.9)
  assertEquals(parseRate(0, { promo: 3 }), null)
  assertEquals(parseRate(0, { invalid_parse: 2 }), 0)
})

Deno.test('list_users: ghép GoTrue + stats theo id, mới nhất trước, không có field nội dung giao dịch', async () => {
  const { deps } = fakeDeps()
  const res = await handleAction(deps, ADMIN, { action: 'list_users' })
  assertEquals(res.status, 200)
  const users = (res.body as { users: Record<string, unknown>[] }).users
  assertEquals(users.map((u) => u.id), [B, A, OTHER_ADMIN])
  const a = users.find((u) => u.id === A)!
  assertEquals([a.email, a.txCount30d, a.keysActive, a.parseRate30d, a.isAdmin], ['An@x.vn', 9, 1, 0.9, false])
  assertEquals(users.find((u) => u.id === B)!.txCount30d, 0) // không có dòng stats -> 0, không crash
  const text = JSON.stringify(res.body)
  for (const banned of ['amount', 'description', 'raw_text', 'merchant', 'balance']) {
    assertEquals(text.includes(banned), false, `response chứa "${banned}"`)
  }
})

Deno.test('list_users: tìm email không phân biệt hoa thường', async () => {
  const res = await handleAction(fakeDeps().deps, ADMIN, { action: 'list_users', search: ' AN@ ' })
  assertEquals((res.body as { users: { id: string }[] }).users.map((u) => u.id), [A])
})

Deno.test('get_user: id sai -> 400, không tồn tại -> 404, có -> user + keys', async () => {
  const { deps } = fakeDeps()
  assertEquals((await handleAction(deps, ADMIN, { action: 'get_user', userId: 'x' })).status, 400)
  assertEquals((await handleAction(deps, ADMIN, { action: 'get_user', userId: 'dddddddd-0000-4000-a000-000000000004' })).status, 404)
  const res = await handleAction(deps, ADMIN, { action: 'get_user', userId: A })
  assertEquals(res.status, 200)
  assertEquals((res.body as { user: { id: string } }).user.id, A)
})

Deno.test('get_user: ghi audit view_user TRƯỚC khi trả dữ liệu; ghi lỗi -> 500, không trả dữ liệu', async () => {
  const { deps, calls } = fakeDeps()
  await handleAction(deps, ADMIN, { action: 'get_user', userId: A })
  assertEquals(calls[0], { fn: 'admin_log_view', params: { p_admin: ADMIN, p_user: A } })
  const broken = fakeDeps({}, { admin_log_view: { data: null, error: { code: 'XX000', message: 'disk full' } } })
  const res = await handleAction(broken.deps, ADMIN, { action: 'get_user', userId: A })
  assertEquals(res, { status: 500, body: { error: 'internal_error' } })
  assertEquals(broken.calls.map((c) => c.fn), ['admin_log_view'])
})

Deno.test('suspend: RPC trước (kèm admin id + lý do đã trim), rồi ban GoTrue', async () => {
  const { deps, calls, bans } = fakeDeps()
  const res = await handleAction(deps, ADMIN, { action: 'suspend', userId: A, reason: '  lam dung api  ' })
  assertEquals(res, { status: 200, body: { suspended: true } })
  assertEquals(calls, [{ fn: 'admin_set_suspended', params: { p_admin: ADMIN, p_user: A, p_suspend: true, p_reason: 'lam dung api' } }])
  assertEquals(bans, [[A, true]])
})

Deno.test('unsuspend: gỡ ban', async () => {
  const { deps, bans } = fakeDeps()
  await handleAction(deps, ADMIN, { action: 'unsuspend', userId: A, reason: 'da xac minh' })
  assertEquals(bans, [[A, false]])
})

Deno.test('suspend: lý do thiếu / < 5 ký tự -> 400, không gọi gì', async () => {
  for (const reason of [undefined, '', 'abc ', 42]) {
    const { deps, calls, bans } = fakeDeps()
    assertEquals((await handleAction(deps, ADMIN, { action: 'suspend', userId: A, reason })).status, 400)
    assertEquals([calls.length, bans.length], [0, 0])
  }
})

Deno.test('suspend / revoke_keys: không nhắm chính mình hoặc admin khác', async () => {
  for (const action of ['suspend', 'unsuspend', 'revoke_keys']) {
    const { deps, calls } = fakeDeps()
    const self = await handleAction(deps, ADMIN, { action, userId: ADMIN, reason: 'thu nghiem' })
    const other = await handleAction(deps, ADMIN, { action, userId: OTHER_ADMIN, reason: 'thu nghiem' })
    assertEquals([self.body, other.body], [{ error: 'cannot_target_self' }, { error: 'cannot_target_admin' }])
    assertEquals(calls.length, 0)
  }
})

Deno.test('suspend: ban GoTrue lỗi -> 502 ban_failed (cờ DB đã đặt, bấm lại an toàn)', async () => {
  const { deps } = fakeDeps({ setBan: () => Promise.reject(new Error('gotrue down')) })
  assertEquals(await handleAction(deps, ADMIN, { action: 'suspend', userId: A, reason: 'lam dung api' }),
    { status: 502, body: { error: 'ban_failed' } })
})

Deno.test('suspend: RPC lỗi -> KHÔNG ban; P0002 -> 404, mã khác -> 500 không lộ message', async () => {
  const p0002 = fakeDeps({}, { admin_set_suspended: { data: null, error: { code: 'P0002', message: 'x' } } })
  assertEquals((await handleAction(p0002.deps, ADMIN, { action: 'suspend', userId: A, reason: 'lam dung api' })).status, 404)
  assertEquals(p0002.bans.length, 0)
  const other = fakeDeps({}, { admin_set_suspended: { data: null, error: { code: 'XX000', message: 'relation user_settings' } } })
  assertEquals(await handleAction(other.deps, ADMIN, { action: 'suspend', userId: A, reason: 'lam dung api' }),
    { status: 500, body: { error: 'internal_error' } })
})

Deno.test('revoke_keys: trả số key đã thu hồi', async () => {
  const { deps, calls } = fakeDeps({}, { admin_revoke_user_keys: { data: 2, error: null } })
  assertEquals(await handleAction(deps, ADMIN, { action: 'revoke_keys', userId: A, reason: 'lo key tren github' }),
    { status: 200, body: { revoked: 2 } })
  assertEquals(calls[0].params, { p_admin: ADMIN, p_user: A, p_reason: 'lo key tren github' })
})

Deno.test('list_audit: lọc theo user hợp lệ, id sai -> 400, mặc định limit 50', async () => {
  const { deps, calls } = fakeDeps()
  await handleAction(deps, ADMIN, { action: 'list_audit' })
  assertEquals(calls[0].params, { p_user: null, p_limit: 50, p_offset: 0 })
  assertEquals((await handleAction(deps, ADMIN, { action: 'list_audit', userId: 'x' })).status, 400)
})

Deno.test('action lạ -> 400 unknown_action', async () => {
  for (const action of ['delete_user', 'set_features', undefined, '__proto__']) {
    assertEquals((await handleAction(fakeDeps().deps, ADMIN, { action })).body, { error: 'unknown_action' })
  }
})

Deno.test('lý do: đúng 500 ký tự được nhận, 501 bị từ chối trước mọi lời gọi (suspend/unsuspend/revoke_keys)', async () => {
  for (const action of ['suspend', 'unsuspend', 'revoke_keys']) {
    const ok = fakeDeps()
    assertEquals((await handleAction(ok.deps, ADMIN, { action, userId: A, reason: 'x'.repeat(500) })).status, 200)
    const tooLong = fakeDeps()
    assertEquals(await handleAction(tooLong.deps, ADMIN, { action, userId: A, reason: 'x'.repeat(501) }),
      { status: 400, body: { error: 'invalid_reason' } })
    assertEquals([tooLong.calls.length, tooLong.bans.length], [0, 0])
  }
})

Deno.test('unsuspend / revoke_keys: lý do thiếu, rỗng hoặc sai kiểu -> 400, không gọi RPC / ban', async () => {
  for (const action of ['unsuspend', 'revoke_keys']) {
    for (const reason of [undefined, '  abc  ', 7]) {
      const { deps, calls, bans } = fakeDeps()
      assertEquals((await handleAction(deps, ADMIN, { action, userId: A, reason })).body, { error: 'invalid_reason' })
      assertEquals([calls.length, bans.length], [0, 0])
    }
  }
})

Deno.test('nhắm chính admin (có trong GoTrue, role admin) -> cannot_target_self (kiểm trước cannot_target_admin)', async () => {
  const self: AuthUser = { id: ADMIN, email: 'me@x.vn', created_at: '2026-09-01T00:00:00Z', app_metadata: { role: 'admin' } }
  for (const action of ['suspend', 'unsuspend', 'revoke_keys']) {
    const { deps, calls, bans } = fakeDeps({ getAuthUser: () => Promise.resolve(self) })
    assertEquals((await handleAction(deps, ADMIN, { action, userId: ADMIN, reason: 'thu nghiem' })).body, { error: 'cannot_target_self' })
    assertEquals([calls.length, bans.length], [0, 0])
  }
})

Deno.test('RPC 23514 (CHECK lý do) -> 400 invalid_reason, không ban; revoke_keys P0002 -> 404', async () => {
  const bad = fakeDeps({}, { admin_set_suspended: { data: null, error: { code: '23514', message: 'check violated' } } })
  assertEquals(await handleAction(bad.deps, ADMIN, { action: 'suspend', userId: A, reason: 'lam dung api' }),
    { status: 400, body: { error: 'invalid_reason' } })
  assertEquals(bad.bans.length, 0)
  const gone = fakeDeps({}, { admin_revoke_user_keys: { data: null, error: { code: 'P0002', message: 'x' } } })
  assertEquals((await handleAction(gone.deps, ADMIN, { action: 'revoke_keys', userId: A, reason: 'lo key tren github' })).status, 404)
})
