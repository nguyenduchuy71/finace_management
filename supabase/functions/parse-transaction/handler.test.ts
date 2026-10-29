// Pipeline parse-transaction (handler.ts) với auth + DB giả: các giới hạn request phải được thực thi
// TRƯỚC khi chạm DB/parser (CLAUDE: MAX_TEXT_LENGTH 2000 và body > 16000 -> 413 trước JSON.parse).
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { createHandler } from './handler.ts'
import { MAX_BODY_LENGTH, MAX_TEXT_LENGTH } from './request.ts'
import type { IngestStore } from './persist.ts'

// Giá trị CỐ ĐỊNH theo docs/claude/edge-functions.md: đổi hằng số trong request.ts mà không đổi chủ ý thì test này đỏ.
const DOC_MAX_BODY = 16_000
const DOC_MAX_TEXT = 2000

const KEY = 'vj_' + 'a'.repeat(43)
const USER = '00000000-0000-0000-0000-000000000001'

function setup(opts: { dup?: boolean; insert?: 'no_account' | 'inserted' | 'held' | 'held_full' } = {}) {
  const calls: string[] = []
  const store = {
    isDuplicate: () => { calls.push('dup'); return Promise.resolve(!!opts.dup) },
    saveUnparsed: (_t: string, _s: string | null, reason: string) => { calls.push(`unparsed:${reason}`); return Promise.resolve() },
    insertTx: () => {
      calls.push('insert')
      if (opts.insert && opts.insert !== 'inserted') return Promise.resolve({ kind: opts.insert })
      return Promise.resolve({ kind: 'inserted' as const, refs: { account_id: 'acc-1' } })
    },
  } as unknown as IngestStore
  const handler = createHandler({
    authenticate: () => Promise.resolve({
      data: [{ user_id: USER, owner_names: [], rate_limited: false, suspended: false }], error: null,
    }),
    legacy: { ownerNames: [] },
    store,
  })
  const call = (raw: string, authed = true) => handler(new Request('http://x/', {
    method: 'POST',
    headers: authed ? { authorization: `Bearer ${KEY}` } : {},
    body: raw,
  }))
  return { calls, call }
}
const send = (text: string, extra: Record<string, unknown> = {}) => JSON.stringify({ text, ...extra })
const LPBANK = 'TK 03xxx265 -430VND 01092026 19:35 SD:44VND ND: Thu phi QLTK thang 082026'

Deno.test('chưa xác thực -> 401, không chạm DB', async () => {
  const { calls, call } = setup()
  assertEquals((await call(send(LPBANK), false)).status, 401)
  assertEquals(calls, [])
})

Deno.test('hằng số giới hạn khớp tài liệu (16000 / 2000)', () => {
  assertEquals([MAX_BODY_LENGTH, MAX_TEXT_LENGTH], [DOC_MAX_BODY, DOC_MAX_TEXT])
})

Deno.test(`body > ${MAX_BODY_LENGTH} ký tự -> 413 {error, max}, kiểm TRƯỚC JSON.parse (rác không phải JSON vẫn 413)`, async () => {
  const { calls, call } = setup()
  for (const raw of ['x'.repeat(MAX_BODY_LENGTH + 1), send('a', { pad: 'y'.repeat(MAX_BODY_LENGTH) })]) {
    const res = await call(raw)
    assertEquals([res.status, await res.json()], [413, { error: 'body too large', max: MAX_BODY_LENGTH }])
  }
  assertEquals(calls, [])
})

Deno.test(`text > ${MAX_TEXT_LENGTH} ký tự -> 413 {error, max}, không chạm DB/parser`, async () => {
  const { calls, call } = setup()
  const res = await call(send('a'.repeat(MAX_TEXT_LENGTH + 1)))
  assertEquals([res.status, await res.json()], [413, { error: 'text too long', max: MAX_TEXT_LENGTH }])
  assertEquals(calls, [])
})

Deno.test(`text đúng ${MAX_TEXT_LENGTH} ký tự vẫn được xử lý (no_match, lưu hộp tin)`, async () => {
  const { calls, call } = setup()
  const res = await call(send('a'.repeat(MAX_TEXT_LENGTH)))
  assertEquals([res.status, await res.json()], [200, { skipped: 'no_match' }])
  assertEquals(calls, ['dup', 'unparsed:no_match'])
})

Deno.test('độ dài text tính SAU chuẩn hoá NFC (NFD 2000 ký tự gốc dài hơn vẫn qua)', async () => {
  const { call } = setup()
  const nfd = 'ố'.normalize('NFD').repeat(MAX_TEXT_LENGTH / 2) // 3000 code unit, NFC còn 1000
  assertEquals(nfd.length > MAX_TEXT_LENGTH, true)
  assertEquals((await call(send(nfd))).status, 200)
})

Deno.test('JSON hỏng -> 400 invalid json; thiếu/rỗng/không phải chuỗi text -> 400 missing text', async () => {
  const { call } = setup()
  const bad = await call('{oops')
  assertEquals([bad.status, await bad.json()], [400, { error: 'invalid json' }])
  for (const raw of [JSON.stringify({}), send('   '), JSON.stringify({ text: 5 }), 'null']) {
    const res = await call(raw)
    assertEquals([res.status, await res.json()], [400, { error: 'missing text' }])
  }
})

Deno.test('OTP -> skipped, không lưu; trùng -> skipped duplicate', async () => {
  const otp = setup()
  assertEquals(await (await otp.call(send('Ma OTP cua ban la 123456'))).json(), { skipped: 'otp_or_security' })
  assertEquals(otp.calls, [])
  const dup = setup({ dup: true })
  assertEquals(await (await dup.call(send(LPBANK))).json(), { skipped: 'duplicate' })
  assertEquals(dup.calls, ['dup'])
})

Deno.test('parser khớp -> 201 inserted kèm FK, KHÔNG trả raw_text', async () => {
  const { call } = setup()
  const res = await call(send(LPBANK))
  const body = await res.json()
  assertEquals(res.status, 201)
  assertEquals([body.inserted.bank_name, body.inserted.amount, body.inserted.account_id], ['LPBank', -430, 'acc-1'])
  assertEquals('raw_text' in body.inserted, false)
})

Deno.test('khớp nhưng không có TK/thẻ -> 200 skipped no_account (bank + account_ref)', async () => {
  const { call } = setup({ insert: 'no_account' })
  const res = await call(send(LPBANK))
  assertEquals([res.status, await res.json()], [200, { skipped: 'no_account', bank: 'LPBank', account_ref: 'x265' }])
})

Deno.test('regex khớp nhưng dữ liệu vô nghĩa -> 422 invalid_parse, lưu hộp tin', async () => {
  const { calls, call } = setup()
  const res = await call(send('TK 03xxx265 -0VND 01092026 19:35 SD:44VND ND: x'))
  assertEquals([res.status, await res.json()], [422, { skipped: 'invalid_parse', bank: 'LPBank' }])
  assertEquals(calls, ['dup', 'unparsed:invalid_parse'])
})

Deno.test('hết credit, tin được giữ -> 202 skipped no_credit (không trả dữ liệu giao dịch)', async () => {
  const { call } = setup({ insert: 'held' })
  const res = await call(send(LPBANK))
  assertEquals([res.status, await res.json()], [202, { skipped: 'no_credit' }])
})

Deno.test('hết credit và đủ trần tin treo -> 402, tin không được lưu', async () => {
  const { call } = setup({ insert: 'held_full' })
  const res = await call(send(LPBANK))
  assertEquals([res.status, await res.json()], [402, { error: 'no_credit', held: false }])
})
