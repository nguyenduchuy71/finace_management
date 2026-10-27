import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { resolveCaller, sha256Hex, type AuthenticateRow } from './api-key-auth.ts'

const KEY = 'vj_' + 'A'.repeat(40) + '-_9'
const USER = 'aaaaaaaa-0000-4000-a000-000000000001'
const LEGACY = { secret: 's3cret', userId: 'legacy-user', ownerNames: ['OWNER'] }

/** RPC giả: ghi lại hash nhận được, trả các dòng cho trước. */
function rpc(rows: AuthenticateRow[] | null, error: { message: string } | null = null) {
  const calls: string[] = []
  const fn = (h: string) => { calls.push(h); return Promise.resolve({ data: rows, error }) }
  return { fn, calls }
}

const bearer = (k: string) => new Headers({ authorization: `Bearer ${k}` })

Deno.test('sha256Hex khớp vector chuẩn', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

Deno.test('key hợp lệ -> user + owner names, gửi hash (không phải plaintext) vào RPC', async () => {
  const r = rpc([{ user_id: USER, owner_names: ['NGUYEN VAN A'], rate_limited: false }])
  const got = await resolveCaller(bearer(KEY), r.fn, LEGACY)
  assertEquals(got, { ok: true, caller: { userId: USER, ownerNames: ['NGUYEN VAN A'] } })
  assertEquals(r.calls, [await sha256Hex(KEY)])
})

Deno.test('owner_names null -> mảng rỗng', async () => {
  const got = await resolveCaller(bearer(KEY), rpc([{ user_id: USER, owner_names: null, rate_limited: false }]).fn, LEGACY)
  assertEquals(got.ok && got.caller.ownerNames, [])
})

Deno.test('key sai định dạng -> 401, không gọi DB', async () => {
  for (const k of ['vj_short', 'sk_' + 'A'.repeat(43), 'vj_' + 'A'.repeat(42) + '=']) {
    const r = rpc([])
    assertEquals(await resolveCaller(bearer(k), r.fn, LEGACY), { ok: false, status: 401, error: 'unauthorized' })
    assertEquals(r.calls.length, 0)
  }
})

Deno.test('key không tồn tại / đã thu hồi (0 dòng) -> 401', async () => {
  assertEquals(await resolveCaller(bearer(KEY), rpc([]).fn, LEGACY), { ok: false, status: 401, error: 'unauthorized' })
})

Deno.test('rate limited -> 429', async () => {
  const got = await resolveCaller(bearer(KEY), rpc([{ user_id: USER, owner_names: [], rate_limited: true }]).fn, LEGACY)
  assertEquals(got, { ok: false, status: 429, error: 'rate limited' })
})

Deno.test('lỗi DB -> 500 (không coi là 401)', async () => {
  const got = await resolveCaller(bearer(KEY), rpc(null, { message: 'boom' }).fn, LEGACY)
  assertEquals(got, { ok: false, status: 500, error: 'auth unavailable' })
})

Deno.test('Bearer có mặt thì KHÔNG rơi về legacy dù secret đúng', async () => {
  const h = new Headers({ authorization: 'Bearer vj_bad', 'x-shortcut-secret': 's3cret' })
  assertEquals((await resolveCaller(h, rpc([]).fn, LEGACY)).ok, false)
})

Deno.test('legacy: secret đúng -> DEFAULT_USER_ID + OWNER_NAMES env', async () => {
  const got = await resolveCaller(new Headers({ 'x-shortcut-secret': 's3cret' }), rpc([]).fn, LEGACY)
  assertEquals(got, { ok: true, caller: { userId: 'legacy-user', ownerNames: ['OWNER'] } })
})

Deno.test('legacy: secret sai / thiếu header / chưa cấu hình -> 401', async () => {
  const deny = { ok: false, status: 401, error: 'unauthorized' } as const
  assertEquals(await resolveCaller(new Headers({ 'x-shortcut-secret': 'nope' }), rpc([]).fn, LEGACY), deny)
  assertEquals(await resolveCaller(new Headers(), rpc([]).fn, LEGACY), deny)
  assertEquals(await resolveCaller(new Headers({ 'x-shortcut-secret': 's3cret' }), rpc([]).fn,
    { ownerNames: [] }), deny)
  assertEquals(await resolveCaller(new Headers({ 'x-shortcut-secret': 's3cret' }), rpc([]).fn,
    { secret: 's3cret', ownerNames: [] }), deny)
})
