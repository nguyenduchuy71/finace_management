// resolveRefs với DB giả lập trong bộ nhớ: áp đúng các bộ lọc eq/like/limit mà code gọi,
// nên test bắt được cả lỗi quên lọc user_id / bank_name.
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveRefs } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

type Row = Record<string, string>

function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from(table: string) {
      let rows = tables[table] ?? []
      const q = {
        select: () => q,
        eq: (col: string, v: string) => { rows = rows.filter((r) => r[col] === v); return q },
        like: (col: string, pattern: string) => {
          const suffix = pattern.replace(/^%/, '')
          rows = rows.filter((r) => r[col].endsWith(suffix))
          return q
        },
        limit: (n: number) => Promise.resolve({ data: rows.slice(0, n).map((r) => ({ id: r.id })), error: null }),
      }
      return q
    },
  } as unknown as SupabaseClient
}

const momoTx: ParsedTransaction = {
  bank_name: 'MoMo', amount: -39000, currency: 'VND', transaction_date: '2026-10-20T12:00:00+07:00',
  description: 'KAI COFFEE', raw_text: 'x', source_type: 'bank', account_ref: null, merchant_name: 'KAI COFFEE',
}
const momoAcc = (id: string, user = 'u1'): Row => ({ id, user_id: user, bank_name: 'MoMo', account_number: '****0123' })

Deno.test('MoMo: đúng 1 tài khoản MoMo -> gắn account_id', async () => {
  assertEquals(await resolveRefs(fakeDb({ accounts: [momoAcc('a1')] }), momoTx, 'u1'), { account_id: 'a1' })
})

Deno.test('MoMo: 0 tài khoản MoMo -> {} (vào hộp tin)', async () => {
  const other: Row = { id: 'b1', user_id: 'u1', bank_name: 'LPBank', account_number: '****x265' }
  assertEquals(await resolveRefs(fakeDb({ accounts: [other] }), momoTx, 'u1'), {})
})

Deno.test('MoMo: >= 2 tài khoản MoMo -> {} (không đoán)', async () => {
  const db = fakeDb({ accounts: [momoAcc('a1'), { ...momoAcc('a2'), account_number: '****9999' }] })
  assertEquals(await resolveRefs(db, momoTx, 'u1'), {})
})

Deno.test('MoMo: chỉ tính tài khoản của chính user (MoMo của user khác không được gắn)', async () => {
  assertEquals(await resolveRefs(fakeDb({ accounts: [momoAcc('a1', 'u2')] }), momoTx, 'u1'), {})
  // 1 của mình + 1 của người khác vẫn là "đúng 1"
  assertEquals(await resolveRefs(fakeDb({ accounts: [momoAcc('a1'), momoAcc('a2', 'u2')] }), momoTx, 'u1'), { account_id: 'a1' })
})

Deno.test('bank khác không có account_ref -> {} dù user có đúng 1 tài khoản bank đó', async () => {
  const tx = { ...momoTx, bank_name: 'LPBank' }
  const acc: Row = { id: 'b1', user_id: 'u1', bank_name: 'LPBank', account_number: '****x265' }
  assertEquals(await resolveRefs(fakeDb({ accounts: [acc] }), tx, 'u1'), {})
})

Deno.test('có account_ref vẫn khớp theo đuôi như cũ', async () => {
  const tx = { ...momoTx, bank_name: 'LPBank', account_ref: 'x265' }
  const acc: Row = { id: 'b1', user_id: 'u1', bank_name: 'LPBank', account_number: '****x265' }
  assertEquals(await resolveRefs(fakeDb({ accounts: [acc] }), tx, 'u1'), { account_id: 'b1' })
})
