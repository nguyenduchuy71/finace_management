import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { createAccount } from './account-mutations'
import { getCreditBalance, getCreditLedger, getHeldCount } from './credits'
import { getUnparsedMessages, resolveUnparsed } from './unparsed-messages'
import type { AccountFormValues } from '@/types/account-form'

// Migration 20261030100000 (phase 2 credit): ingest nguyên tử, tin giữ `no_credit`, replay, unlimited.
// Edge function không chạy trong integration -> gọi thẳng RPC bằng service_role (đúng thứ edge function gọi);
// hợp đồng HTTP của function đã phủ ở Deno test (credit-ingest.test.ts, handler.test.ts).
//
// TỰ CHỨA, không sửa seed: test user có số dư thật từ migration (welcome). Test tự đưa số dư về 1, rồi KHÔI PHỤC
// ở cleanup: xoá dòng sổ cái do test tạo (ref 'itest:*' + usage của giao dịch test), tính lại balance = sum(delta)
// (bất biến), trả cờ unlimited. Cleanup cũng chạy ở beforeAll để dọn sót của lần chạy trước bị crash.
// Ca chéo 2 user + quyền: supabase/tests/credit-ledger-rls.sql, credit-concurrency.sql.

const serviceKey = import.meta.env.VITE_TEST_SERVICE_ROLE_KEY as string | undefined
if (!serviceKey) {
  throw new Error('Thiếu VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local (SERVICE_ROLE_KEY của `supabase status -o env`).')
}
const admin = createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MARK = 'ITEST-CREDIT:'
const ACCOUNT: AccountFormValues = {
  bankName: 'TestBankCredit', accountName: 'TK test credit', accountNumber: '****c001',
  accountType: 'checking', balance: 0,
}

let userId = ''
let accountId = ''
let originalUnlimited = false

const tx = (label: string) => ({
  bank_name: ACCOUNT.bankName, amount: -1000, currency: 'VND', transaction_date: '2031-04-01T09:00:00+07:00',
  description: label, raw_text: MARK + label, source_type: 'bank', account_ref: 'c001', merchant_name: null, kind: 'normal',
})

async function ingest(label: string) {
  const { data, error } = await admin.rpc('ingest_transaction', {
    p_user: userId, p_tx: tx(label), p_refs: { account_id: accountId }, p_source: 'itest',
  })
  if (error) throw error
  return data as { status: string; id?: string }
}

async function ledgerSum(): Promise<number> {
  const { data, error } = await admin.from('credit_ledger').select('delta').eq('user_id', userId)
  if (error) throw error
  return data.reduce((s, r) => s + (r.delta as number), 0)
}

async function setBalanceTo(target: number) {
  const delta = target - (await ledgerSum())
  if (delta === 0) return
  const { error } = await admin.rpc('_apply_credit', {
    p_user: userId, p_delta: delta, p_kind: 'adjust', p_ref: `itest:set:${crypto.randomUUID()}`,
  })
  if (error) throw error
}

async function cleanup() {
  const { data: txs } = await admin.from('transactions').select('id').like('raw_text', `${MARK}%`)
  const ids = (txs ?? []).map((t) => t.id as string)
  const { data: accounts } = await admin.from('accounts').select('id').eq('bank_name', ACCOUNT.bankName)
  for (const a of accounts ?? []) {
    await admin.from('transactions').delete().eq('account_id', a.id)
    await admin.from('accounts').delete().eq('id', a.id)
  }
  await admin.from('unparsed_messages').delete().like('raw_text', `${MARK}%`)
  await admin.from('credit_ledger').delete().eq('user_id', userId).like('ref', 'itest:%')
  if (ids.length) await admin.from('credit_ledger').delete().eq('user_id', userId).in('ref', ids)
  // Bất biến balance = sum(delta): tính lại từ sổ cái đã dọn thay vì nhớ số cũ (đúng cả khi lần trước crash).
  await admin.from('credit_balances')
    .update({ balance: await ledgerSum(), unlimited: originalUnlimited }).eq('user_id', userId)
}

beforeAll(async () => {
  const { data } = await supabase.auth.getUser()
  userId = data.user!.id
  const { data: row, error } = await admin.from('credit_balances').select('unlimited').eq('user_id', userId).single()
  if (error) throw new Error(`Test user chưa có ví credit (migration 20261030100000 chưa áp?): ${error.message}`)
  originalUnlimited = row.unlimited as boolean
  await cleanup()
  accountId = (await createAccount(ACCOUNT)).id
  await admin.from('credit_balances').update({ unlimited: false }).eq('user_id', userId)
  await setBalanceTo(1)
})

afterAll(cleanup)

describe('credit: ingest nguyên tử, giữ tin, replay', () => {
  let heldMsgId = ''
  let heldBefore = 0

  it('user test có ví: số dư = sổ cái (bất biến) và đọc được qua service của app', async () => {
    expect(await getCreditBalance()).toEqual({ balance: 1, unlimited: false })
    expect(await ledgerSum()).toBe(1)
  })

  it('2 tin hợp lệ với 1 credit -> 1 giao dịch (trừ 1) + 1 tin treo, số dư 0', async () => {
    heldBefore = await getHeldCount()
    const first = await ingest('A1')
    const second = await ingest('A2')
    expect([first.status, second.status]).toEqual(['inserted', 'held'])
    heldMsgId = second.id!

    expect(await getCreditBalance()).toEqual({ balance: 0, unlimited: false })
    expect(await getHeldCount()).toBe(heldBefore + 1)
    const { data: txs } = await admin.from('transactions').select('raw_text').like('raw_text', `${MARK}%`)
    expect(txs!.map((t) => t.raw_text)).toEqual([`${MARK}A1`])
    const ledger = await getCreditLedger()
    expect(ledger.find((e) => e.kind === 'usage')).toMatchObject({ delta: -1 })
  })

  it('tin treo hiện trong hộp tin với onHold; user KHÔNG tự resolve được (không vượt thanh toán)', async () => {
    const held = (await getUnparsedMessages()).data.find((m) => m.id === heldMsgId)
    expect(held).toMatchObject({ onHold: true })
    await expect(resolveUnparsed(heldMsgId, 'normal', {
      amount: -1000, transactionDate: '2031-04-01T09:00:00+07:00', accountId,
    })).rejects.toMatchObject({ code: '22023' })
    await expect(resolveUnparsed(heldMsgId, 'promo')).rejects.toMatchObject({ code: '22023' })
    const { data } = await admin.from('transactions').select('id').like('raw_text', `${MARK}%`)
    expect(data).toHaveLength(1)
  })

  it('authenticated không gọi được RPC ghi credit và không ghi được sổ cái / cờ unlimited', async () => {
    const rpc = await supabase.rpc('ingest_transaction', { p_user: userId, p_tx: tx('HACK'), p_refs: { account_id: accountId } })
    expect(rpc.error?.code).toBe('42501')
    const replay = await supabase.rpc('replay_held_messages', { p_user: userId })
    expect(replay.error?.code).toBe('42501')
    const ins = await supabase.from('credit_ledger').insert({ user_id: userId, delta: 1000, kind: 'grant', ref: 'itest:hack' })
    expect(ins.error?.code).toBe('42501')
    const upd = await supabase.from('credit_balances').update({ unlimited: true }).eq('user_id', userId)
    expect(upd.error?.code).toBe('42501')
  })

  it('nạp 1 credit (service role) rồi replay -> tin treo thành giao dịch thứ 2, số dư 0', async () => {
    const grant = await admin.rpc('_apply_credit', { p_user: userId, p_delta: 1, p_kind: 'purchase', p_ref: 'itest:order' })
    expect(grant.error).toBeNull()
    const replay = await admin.rpc('replay_held_messages', { p_user: userId })
    expect(replay.data).toBe(1)

    const { data: txs } = await admin.from('transactions').select('raw_text').like('raw_text', `${MARK}%`)
    expect(txs!.map((t) => t.raw_text).sort()).toEqual([`${MARK}A1`, `${MARK}A2`])
    expect(await getCreditBalance()).toEqual({ balance: 0, unlimited: false })
    expect(await getHeldCount()).toBe(heldBefore)
    const { data: msg } = await admin.from('unparsed_messages').select('resolved, transaction_id').eq('id', heldMsgId).single()
    expect(msg).toMatchObject({ resolved: true })
    expect(msg!.transaction_id).not.toBeNull()
    // Bất biến sau toàn bộ chuỗi thao tác.
    expect(await ledgerSum()).toBe(0)
  })

  it('replay lần 2 khi không còn tin treo -> 0, không ghi thêm', async () => {
    const replay = await admin.rpc('replay_held_messages', { p_user: userId })
    expect(replay.data).toBe(0)
  })
})

describe('credit: unlimited', () => {
  it('unlimited: ghi không trừ, không có dòng usage mới, UI đọc được cờ', async () => {
    await admin.from('credit_balances').update({ unlimited: true }).eq('user_id', userId)
    const usageBefore = (await getCreditLedger()).filter((e) => e.kind === 'usage').length
    expect((await ingest('U1')).status).toBe('inserted')
    expect((await ingest('U2')).status).toBe('inserted')
    expect(await getCreditBalance()).toEqual({ balance: 0, unlimited: true })
    expect((await getCreditLedger()).filter((e) => e.kind === 'usage')).toHaveLength(usageBefore)
  })
})
