import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getCreditBalance } from './credits'
import { getOrder, listOrders, listPackages } from './payments'

// Migration 20261031100000 (phase 3 thanh toán): gói, đơn, fulfill_order idempotent, RLS thật qua PostgREST.
// Edge function IPN không chạy trong integration -> gọi thẳng RPC bằng service_role (đúng thứ function gọi);
// chữ ký HMAC + hợp đồng HTTP đã phủ ở Deno test (supabase/functions/_shared/*.test.ts).
// Ca chéo user + song song: supabase/tests/payment-orders-rls.sql, payment-fulfill.sql.
//
// TỰ CHỨA: mọi đơn / sự kiện / dòng sổ cái do test tạo đều dọn ở cleanup (cả beforeAll để dọn sót lần crash),
// rồi tính lại balance = sum(delta) (bất biến) để trả số dư test user về như cũ.

const serviceKey = import.meta.env.VITE_TEST_SERVICE_ROLE_KEY as string | undefined
if (!serviceKey) {
  throw new Error('Thiếu VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local (SERVICE_ROLE_KEY của `supabase status -o env`).')
}
const admin = createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TX_PREFIX = 'ITEST-PAY-'
let userId = ''

async function ledgerSum(): Promise<number> {
  const { data, error } = await admin.from('credit_ledger').select('delta').eq('user_id', userId)
  if (error) throw error
  return data.reduce((s, r) => s + (r.delta as number), 0)
}

async function newOrder(provider: 'momo' | 'zalopay', pkg: string) {
  const { data, error } = await admin.rpc('create_payment_order', { p_user: userId, p_provider: provider, p_package_id: pkg })
  if (error) throw error
  return data as { id: string; provider_order_ref: string; amount_vnd: number; credits: number; status: string }
}

const fulfill = async (provider: string, ref: string, tx: string, amount: number) => {
  const { data, error } = await admin.rpc('fulfill_order', { p_provider: provider, p_order_ref: ref, p_provider_tx_id: tx, p_amount: amount })
  if (error) throw error
  return data as string
}

async function cleanup() {
  const { data: orders } = await admin.from('payment_orders').select('id, provider_order_ref').eq('user_id', userId)
  const ids = (orders ?? []).map((o) => o.id as string)
  const refs = (orders ?? []).map((o) => o.provider_order_ref as string)
  if (ids.length) await admin.from('credit_ledger').delete().eq('user_id', userId).eq('kind', 'purchase').in('ref', ids)
  if (refs.length) await admin.from('payment_events').delete().in('order_ref', refs)
  await admin.from('payment_orders').delete().eq('user_id', userId)
  await admin.from('credit_balances').update({ balance: await ledgerSum() }).eq('user_id', userId)
}

beforeAll(async () => {
  const { data } = await supabase.auth.getUser()
  userId = data.user!.id
  const { error } = await admin.from('credit_balances').select('balance').eq('user_id', userId).single()
  if (error) throw new Error(`Test user chưa có ví credit: ${error.message}`)
  await cleanup()
})

afterAll(cleanup)

describe('thanh toán: gói + đơn + fulfill (RLS thật)', () => {
  it('user thấy các gói đang bán, theo thứ tự sort, giá/credit từ DB', async () => {
    const pkgs = await listPackages()
    expect(pkgs.slice(0, 3)).toEqual([
      { id: 'p50k', credits: 500, priceVnd: 50000 },
      { id: 'p100k', credits: 1200, priceVnd: 100000 },
      { id: 'p200k', credits: 3000, priceVnd: 200000 },
    ])
  })

  it('đơn tạo bởi service_role: user đọc được (status pending, chụp giá từ gói); user KHÔNG ghi / gọi RPC', async () => {
    const o = await newOrder('momo', 'p50k')
    expect(o).toMatchObject({ amount_vnd: 50000, credits: 500, status: 'pending' })
    expect(o.provider_order_ref).toMatch(/^\d{6}_[a-z0-9]{12}$/)

    expect(await getOrder(o.id)).toMatchObject({ id: o.id, status: 'pending', amountVnd: 50000, credits: 500, provider: 'momo' })
    expect((await listOrders()).map((x) => x.id)).toContain(o.id)

    // authenticated: UPDATE bị chặn bởi grant (42501), không phải âm thầm 0 dòng.
    const upd = await supabase.from('payment_orders').update({ status: 'paid' }).eq('id', o.id)
    expect(upd.error?.code).toBe('42501')
    const rpc = await supabase.rpc('fulfill_order', { p_provider: 'momo', p_order_ref: o.provider_order_ref, p_provider_tx_id: TX_PREFIX + 'hack', p_amount: 50000 })
    expect(rpc.error?.code).toBe('42501')
    expect((await supabase.from('payment_events').select('id')).error?.code).toBe('42501')
    expect((await getOrder(o.id))?.status).toBe('pending')
  })

  it('fulfill: đúng tiền -> paid, +500 credit, hiện trong số dư; IPN lặp -> duplicate không cộng lần 2', async () => {
    const before = (await getCreditBalance()).balance
    const o = await newOrder('momo', 'p50k')
    expect(await fulfill('momo', o.provider_order_ref, TX_PREFIX + '1', 50000)).toBe('paid')
    expect((await getCreditBalance()).balance).toBe(before + 500)
    expect(await getOrder(o.id)).toMatchObject({ status: 'paid' })

    expect(await fulfill('momo', o.provider_order_ref, TX_PREFIX + '1', 50000)).toBe('duplicate')
    expect((await getCreditBalance()).balance).toBe(before + 500)
    const { data: rows } = await admin.from('credit_ledger').select('delta').eq('kind', 'purchase').eq('ref', o.id)
    expect(rows).toEqual([{ delta: 500 }])
  })

  it('fulfill: lệch tiền -> mismatch, KHÔNG cộng; đơn lạ -> unknown_order', async () => {
    const before = (await getCreditBalance()).balance
    const o = await newOrder('zalopay', 'p100k')
    expect(await fulfill('zalopay', o.provider_order_ref, TX_PREFIX + '2', 99999)).toBe('mismatch')
    expect((await getCreditBalance()).balance).toBe(before)
    expect(await getOrder(o.id)).toMatchObject({ status: 'mismatch' })
    expect(await fulfill('momo', '999999_doesnotexist', TX_PREFIX + '3', 50000)).toBe('unknown_order')
  })
})
