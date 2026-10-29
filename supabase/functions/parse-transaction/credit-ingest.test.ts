import { assertEquals, assertRejects } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { ingestParsed, type RpcClient } from './credit-ingest.ts'
import type { ParsedTransaction } from './types.ts'

const TX: ParsedTransaction = {
  bank_name: 'LPBank', amount: -430, currency: 'VND', transaction_date: '2026-09-01T19:35:00+07:00',
  description: 'x', raw_text: 'TK 03xxx265 -430VND', source_type: 'bank', account_ref: 'x265', merchant_name: null,
}
const USER = '00000000-0000-0000-0000-000000000001'

function fakeDb(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const db: RpcClient = { rpc: (fn, args) => { calls.push({ fn, args }); return Promise.resolve(result) } }
  return { db, calls }
}

Deno.test('ingestParsed: gọi ĐÚNG MỘT RPC ingest_transaction với user, tx, refs, source', async () => {
  const { db, calls } = fakeDb({ data: { status: 'inserted', id: 'tx-1' }, error: null })
  const res = await ingestParsed(db, TX, { account_id: 'acc-1' }, USER, 'LPBank')
  assertEquals(res, { status: 'inserted', id: 'tx-1' })
  assertEquals(calls, [{ fn: 'ingest_transaction', args: { p_user: USER, p_tx: TX, p_refs: { account_id: 'acc-1' }, p_source: 'LPBank' } }])
})

Deno.test('ingestParsed: held / held_full được trả nguyên trạng thái', async () => {
  assertEquals(await ingestParsed(fakeDb({ data: { status: 'held', id: 'm-1' }, error: null }).db, TX, { card_id: 'c' }, USER, null),
    { status: 'held', id: 'm-1' })
  assertEquals(await ingestParsed(fakeDb({ data: { status: 'held_full' }, error: null }).db, TX, { card_id: 'c' }, USER, null),
    { status: 'held_full' })
})

Deno.test('ingestParsed: RPC lỗi hoặc trạng thái lạ -> throw (không coi là đã ghi)', async () => {
  await assertRejects(() => ingestParsed(fakeDb({ data: null, error: { code: '23514', message: 'x' } }).db, TX, {}, USER, null))
  for (const data of [null, {}, { status: 'ok' }, 'inserted']) {
    await assertRejects(() => ingestParsed(fakeDb({ data, error: null }).db, TX, {}, USER, null))
  }
})

Deno.test('ingestParsed: P0002 / 23503 (TK-thẻ biến mất) -> no_account thay vì throw; lỗi khác vẫn throw', async () => {
  for (const code of ['P0002', '23503']) {
    assertEquals(await ingestParsed(fakeDb({ data: null, error: { code, message: 'x' } }).db, TX, { card_id: 'c' }, USER, null), { status: 'no_account' })
  }
  await assertRejects(() => ingestParsed(fakeDb({ data: null, error: { code: '22023', message: 'x' } }).db, TX, {}, USER, null))
})
