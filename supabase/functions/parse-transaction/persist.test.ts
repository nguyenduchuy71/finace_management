// M3: TK/thẻ bị xoá giữa resolveRefs và RPC ingest_transaction (P0002 / 23503) -> tin vào hộp tin (no_account), KHÔNG 500.
import { assertEquals, assertRejects } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createIngestStore } from './persist.ts'
import type { ParsedTransaction } from './types.ts'

const TX: ParsedTransaction = {
  bank_name: 'LPBank', amount: -430, currency: 'VND', transaction_date: '2026-09-01T19:35:00+07:00',
  description: 'x', raw_text: 'TK 03xxx265 -430VND', source_type: 'bank', account_ref: 'x265', merchant_name: null,
}

/** Client giả: 1 TK khớp cho resolveRefs; rpc trả `rpcResult`; ghi lại tin vào unparsed_messages. */
function fakeClient(rpcResult: { data: unknown; error: { code?: string; message: string } | null }) {
  const inserted: Record<string, unknown>[] = []
  const rpcCalls: string[] = []
  const client = {
    from(table: string) {
      if (table === 'unparsed_messages') {
        return { insert: (row: Record<string, unknown>) => { inserted.push(row); return Promise.resolve({ error: null }) } }
      }
      const q = {
        select: () => q, eq: () => q, like: () => q,
        limit: () => Promise.resolve({ data: [{ id: 'acc-1' }], error: null }),
      }
      return q
    },
    rpc: (fn: string) => { rpcCalls.push(fn); return Promise.resolve(rpcResult) },
  } as unknown as SupabaseClient
  return { client, inserted, rpcCalls }
}

for (const code of ['P0002', '23503']) {
  Deno.test(`RPC lỗi ${code} -> no_account, tin lưu vào hộp tin với reason no_account (không throw)`, async () => {
    const { client, inserted, rpcCalls } = fakeClient({ data: null, error: { code, message: 'account not found' } })
    const res = await createIngestStore(client).insertTx(TX, 'user-1', 'LPBank')
    assertEquals(res, { kind: 'no_account' })
    assertEquals(rpcCalls, ['ingest_transaction'])
    assertEquals(inserted.length, 1)
    assertEquals(inserted[0].reason, 'no_account')
    assertEquals(inserted[0].user_id, 'user-1')
    assertEquals(inserted[0].raw_text, TX.raw_text)
  })
}

Deno.test('RPC lỗi khác (23514) vẫn throw -> handler trả 500, KHÔNG nuốt thành no_account', async () => {
  const { client, inserted } = fakeClient({ data: null, error: { code: '23514', message: 'check' } })
  await assertRejects(() => createIngestStore(client).insertTx(TX, 'user-1', 'LPBank'))
  assertEquals(inserted.length, 0)
})

Deno.test('RPC inserted -> không ghi hộp tin', async () => {
  const { client, inserted } = fakeClient({ data: { status: 'inserted', id: 'tx-1' }, error: null })
  assertEquals((await createIngestStore(client).insertTx(TX, 'user-1', null)).kind, 'inserted')
  assertEquals(inserted.length, 0)
})
