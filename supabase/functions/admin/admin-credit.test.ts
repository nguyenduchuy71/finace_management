// Hành động adjust_credit + số dư trong get_user / list_users của function `admin`.
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { handleAction, type AdminDeps, type AuthUser, type RpcResult } from './admin-actions.ts'

const ADMIN = '99999999-0000-4000-a000-000000000009'
const A = 'aaaaaaaa-0000-4000-a000-000000000001'
const OTHER_ADMIN = 'cccccccc-0000-4000-a000-000000000003'
const users: AuthUser[] = [
  { id: A, email: 'an@x.vn', created_at: '2026-10-01T00:00:00Z', app_metadata: {} },
  { id: OTHER_ADMIN, email: 'ops@x.vn', created_at: '2026-09-01T00:00:00Z', app_metadata: { role: 'admin' } },
]
const stats = {
  user_id: A, suspended_at: null, suspended_reason: null, consent_at: null, keys_active: 0, keys_last_used_at: null,
  tx_count_30d: 0, unparsed_30d: {}, credit_balance: 42, credit_unlimited: false,
}

function setup(results: Record<string, RpcResult> = {}) {
  const calls: { fn: string; params: Record<string, unknown> }[] = []
  const deps: AdminDeps = {
    listAuthUsers: () => Promise.resolve(users),
    getAuthUser: (id) => Promise.resolve(users.find((u) => u.id === id) ?? null),
    setBan: () => Promise.resolve(),
    rpc: (fn, params) => {
      calls.push({ fn, params })
      return Promise.resolve(results[fn] ?? { data: fn === 'admin_user_stats' ? [stats] : [], error: null })
    },
  }
  return { deps, calls }
}

Deno.test('adjust_credit: gọi admin_adjust_credit với admin id + delta + lý do đã trim, trả số dư mới', async () => {
  const { deps, calls } = setup({ admin_adjust_credit: { data: 52, error: null } })
  assertEquals(await handleAction(deps, ADMIN, { action: 'adjust_credit', userId: A, delta: 10, reason: '  tang credit beta ' }),
    { status: 200, body: { balance: 52 } })
  assertEquals(calls, [{ fn: 'admin_adjust_credit', params: { p_admin: ADMIN, p_user: A, p_delta: 10, p_reason: 'tang credit beta' } }])
})

Deno.test('adjust_credit: delta 0 / số thực / chuỗi / NaN / quá trần -> 400 invalid_delta, không gọi RPC', async () => {
  for (const delta of [0, 1.5, '10', NaN, null, undefined, 1_000_001, -1_000_001]) {
    const { deps, calls } = setup()
    assertEquals(await handleAction(deps, ADMIN, { action: 'adjust_credit', userId: A, delta, reason: 'dieu chinh tay' }),
      { status: 400, body: { error: 'invalid_delta' } })
    assertEquals(calls.length, 0)
  }
})

Deno.test('adjust_credit: lý do thiếu / ngắn / dài -> 400 invalid_reason', async () => {
  for (const reason of [undefined, 'abc', 'x'.repeat(501), 5]) {
    const { deps, calls } = setup()
    assertEquals((await handleAction(deps, ADMIN, { action: 'adjust_credit', userId: A, delta: 5, reason })).body, { error: 'invalid_reason' })
    assertEquals(calls.length, 0)
  }
})

Deno.test('adjust_credit: không nhắm chính mình / admin khác / user lạ', async () => {
  const { deps, calls } = setup()
  const base = { action: 'adjust_credit', delta: 5, reason: 'dieu chinh tay' }
  assertEquals((await handleAction(deps, ADMIN, { ...base, userId: ADMIN })).body, { error: 'cannot_target_self' })
  assertEquals((await handleAction(deps, ADMIN, { ...base, userId: OTHER_ADMIN })).body, { error: 'cannot_target_admin' })
  assertEquals((await handleAction(deps, ADMIN, { ...base, userId: 'dddddddd-0000-4000-a000-000000000004' })).status, 404)
  assertEquals((await handleAction(deps, ADMIN, { ...base, userId: 'x' })).status, 400)
  assertEquals(calls.length, 0)
})

Deno.test('adjust_credit: trừ quá số dư (22003) -> 400 insufficient_credit; mã lạ -> 500 không lộ message', async () => {
  const over = setup({ admin_adjust_credit: { data: null, error: { code: '22003', message: 'số dư không đủ để trừ' } } })
  assertEquals(await handleAction(over.deps, ADMIN, { action: 'adjust_credit', userId: A, delta: -999, reason: 'tru qua tay' }),
    { status: 400, body: { error: 'insufficient_credit' } })
  const boom = setup({ admin_adjust_credit: { data: null, error: { code: 'XX000', message: 'relation credit_balances' } } })
  assertEquals(await handleAction(boom.deps, ADMIN, { action: 'adjust_credit', userId: A, delta: 5, reason: 'dieu chinh tay' }),
    { status: 500, body: { error: 'internal_error' } })
})

Deno.test('get_user: trả số dư + 20 dòng sổ cái gần nhất; list_users có creditBalance / creditUnlimited', async () => {
  const ledger = [{ id: 2, delta: -1, kind: 'usage', created_at: '2026-10-30T00:00:00Z' }]
  const { deps, calls } = setup({ admin_user_ledger: { data: ledger, error: null } })
  const res = await handleAction(deps, ADMIN, { action: 'get_user', userId: A })
  const body = res.body as { user: { creditBalance: number; creditUnlimited: boolean }; ledger: unknown }
  assertEquals([body.user.creditBalance, body.user.creditUnlimited, body.ledger], [42, false, ledger])
  assertEquals(calls.find((c) => c.fn === 'admin_user_ledger')?.params, { p_user: A, p_limit: 20 })
  const list = await handleAction(deps, ADMIN, { action: 'list_users' })
  assertEquals((list.body as { users: { id: string; creditBalance: number }[] }).users.find((u) => u.id === A)?.creditBalance, 42)
})
