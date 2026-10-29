import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { handleResolveUnparsed, type ResolveDeps, type RpcResult } from './handler.ts'

const URL_ = 'https://x/functions/v1/resolve-unparsed'
const USER = 'aaaaaaaa-0000-4000-a000-0000000000a1'
const MSG = 'aaaaaaaa-3333-4000-a000-000000000001'
const TX = { amount: -5000, transaction_date: '2026-10-30T10:00:00+07:00', account_id: 'aaaaaaaa-2222-4000-a000-000000000001' }

type Call = { fn: string; params: Record<string, unknown> }
function deps(result: RpcResult, over: Partial<ResolveDeps> = {}): ResolveDeps & { calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    authenticate: () => Promise.resolve(USER),
    rpc: (fn, params) => { calls.push({ fn, params }); return Promise.resolve(result) },
    ...over,
  }
}
const ok: RpcResult = { data: 'tttttttt-0000-4000-a000-000000000001', error: null }
const err = (code: string): RpcResult => ({ data: null, error: { code, message: 'internal detail' } })
const post = (body: unknown) => new Request(URL_, { method: 'POST', body: JSON.stringify(body) })

Deno.test('không JWT hợp lệ -> 401, không gọi RPC', async () => {
  const d = deps(ok, { authenticate: () => Promise.resolve(null) })
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX }), d)
  assertEquals(res.status, 401)
  assertEquals(d.calls.length, 0)
})

Deno.test('thành công: gọi RPC với user từ JWT (không từ body), trả transaction_id', async () => {
  const d = deps(ok)
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX, user_id: 'attacker', p_user: 'attacker' }), d)
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { transaction_id: 'tttttttt-0000-4000-a000-000000000001' })
  assertEquals(d.calls.length, 1)
  assertEquals(d.calls[0].fn, 'resolve_unparsed_charged')
  assertEquals(d.calls[0].params, { p_user: USER, p_msg_id: MSG, p_kind: 'normal', p_tx: TX })
})

Deno.test('trường lạ trong tx bị bỏ; kind không tạo giao dịch -> p_tx null, transaction_id null', async () => {
  const d = deps({ data: null, error: null })
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'promo' }), d)
  assertEquals(await res.json(), { transaction_id: null })
  assertEquals(d.calls[0].params.p_tx, null)

  const d2 = deps(ok)
  await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: { ...TX, user_id: 'x', raw_text: 'y' } }), d2)
  assertEquals(d2.calls[0].params.p_tx, TX)
})

Deno.test('hết credit (22003) -> 402 insufficient_credit', async () => {
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX }), deps(err('22003')))
  assertEquals(res.status, 402)
  assertEquals((await res.json()).error, 'insufficient_credit')
})

Deno.test('user bị khoá (42501) -> 403 suspended', async () => {
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX }), deps(err('42501')))
  assertEquals(res.status, 403)
  assertEquals((await res.json()).error, 'suspended')
})

Deno.test('P0002 -> 404, 22023 -> 400, 23503 -> 409; lỗi lạ -> 500 không lộ message gốc', async () => {
  const run = async (code: string) => {
    const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX }), deps(err(code)))
    return [res.status, JSON.stringify(await res.json())] as const
  }
  assertEquals(await run('P0002'), [404, '{"error":"not_found"}'])
  assertEquals(await run('22023'), [400, '{"error":"invalid_request"}'])
  assertEquals(await run('23503'), [409, '{"error":"account_gone"}'])
  assertEquals(await run('XX000'), [500, '{"error":"internal_error"}'])
})

Deno.test('body sai hình dạng -> 400, không gọi RPC', async () => {
  for (const body of [
    { kind: 'normal', tx: TX }, { message_id: 'not-uuid', kind: 'normal', tx: TX },
    { message_id: MSG, kind: 'bogus' }, { message_id: MSG, kind: 123 },
    { message_id: MSG, kind: 'normal', tx: 'x' }, { message_id: MSG, kind: 'normal', tx: [TX] }, [MSG], null,
  ]) {
    const d = deps(ok)
    const res = await handleResolveUnparsed(post(body), d)
    assertEquals(res.status, 400, JSON.stringify(body))
    assertEquals(d.calls.length, 0)
  }
})

Deno.test('JSON hỏng -> 400; body quá lớn -> 413; GET -> 405; OPTIONS -> 204', async () => {
  const bad = new Request(URL_, { method: 'POST', body: '{nope' })
  assertEquals((await handleResolveUnparsed(bad, deps(ok))).status, 400)
  const big = new Request(URL_, { method: 'POST', body: JSON.stringify({ message_id: MSG, kind: 'normal', x: 'a'.repeat(5000) }) })
  assertEquals((await handleResolveUnparsed(big, deps(ok))).status, 413)
  assertEquals((await handleResolveUnparsed(new Request(URL_), deps(ok))).status, 405)
  assertEquals((await handleResolveUnparsed(new Request(URL_, { method: 'OPTIONS' }), deps(ok))).status, 204)
})

Deno.test('exception bất ngờ -> 500 internal_error', async () => {
  const d = deps(ok, { rpc: () => { throw new Error('boom') } })
  const res = await handleResolveUnparsed(post({ message_id: MSG, kind: 'normal', tx: TX }), d)
  assertEquals(res.status, 500)
  assertEquals((await res.json()).error, 'internal_error')
})
