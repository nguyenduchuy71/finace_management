import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { createServiceClient } from '@/test/integration-admin'

// Migration 20261018140000_card_crud_mcc_cashback.sql: quyền ghi thẻ, cột mcc,
// bảng card_cashback_rules, RPC delete_credit_card.
//
// Dùng chung DB với services.integration.test.ts (assert tổng cố định theo seed)
// nên mọi dữ liệu tạo ở đây phải được dọn sạch, kể cả khi test fail giữa chừng.
// Kiểm tra chéo 2 user (A không đụng được thẻ/rule/giao dịch của B) cần user thứ
// hai mà seed không có -> nằm ở supabase/tests/card-crud-rls.sql (chạy trên
// Postgres tạm, xem hướng dẫn ở đầu file đó).

// authenticated không còn quyền INSERT transactions (chỉ RPC trừ credit): seed giao dịch bằng service_role local.
const admin = createServiceClient()

const NEW_CARD = {
  bank_name: 'TestBank',
  card_name: 'Thẻ test CRUD',
  card_number: '****t901',
  card_type: 'visa',
  statement_date: 10,
  payment_due_date: 28,
}

let userId = ''
const createdCardIds: string[] = []

async function createCard(overrides: Partial<typeof NEW_CARD> = {}) {
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({ ...NEW_CARD, ...overrides })
    .select('id, user_id')
    .single()
  if (error) throw error
  createdCardIds.push(data.id)
  return data
}

async function addTx(cardId: string, amount: number) {
  const { data, error } = await admin
    .from('transactions')
    .insert({
      user_id: userId,
      bank_name: NEW_CARD.bank_name,
      amount,
      transaction_date: new Date().toISOString(),
      source_type: 'credit_card',
      card_id: cardId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const TEST_BANKS = [NEW_CARD.bank_name, 'OtherBank']

beforeAll(async () => {
  const { data } = await supabase.auth.getUser()
  userId = data.user!.id

  // Một lần chạy trước bị crash có thể để lại thẻ test -> test đầu fail vì unique.
  const { data: stale } = await supabase
    .from('credit_cards').select('id').in('bank_name', TEST_BANKS).like('card_number', '****t9%')
  for (const c of stale ?? []) await supabase.rpc('delete_credit_card', { p_card_id: c.id })
})

afterAll(async () => {
  // RPC xoá cả giao dịch lẫn thẻ (rule cascade theo thẻ). Thẻ đã xoá trong test
  // (P0002 = không còn) thì bỏ qua; lỗi khác phải làm fail, vì dữ liệu dư sẽ làm
  // sai tổng cố định của services.integration.test.ts.
  const failures: string[] = []
  for (const id of createdCardIds) {
    const { error } = await supabase.rpc('delete_credit_card', { p_card_id: id })
    if (error && error.code !== 'P0002') failures.push(`${id}: ${error.message}`)
  }
  if (failures.length) throw new Error(`Dọn dữ liệu test thất bại:\n${failures.join('\n')}`)
})

describe('credit_cards: thêm / sửa', () => {
  it('thêm thẻ không gửi user_id -> mặc định là user đang đăng nhập', async () => {
    const card = await createCard()
    expect(card.user_id).toBe(userId)
  })

  it('trùng (bank_name, card_number) bị chặn bằng unique', async () => {
    // Tự tạo thẻ gốc (qua createCard để được dọn) thay vì dựa vào test trước.
    await createCard({ card_number: '****t907' })
    const { error } = await supabase
      .from('credit_cards').insert({ ...NEW_CARD, card_number: '****t907' })
    expect(error?.code).toBe('23505')
  })

  it('cùng số thẻ nhưng khác ngân hàng được phép', async () => {
    const card = await createCard({ bank_name: 'OtherBank' })
    expect(card.id).toBeTruthy()
  })

  it('sửa thẻ của mình', async () => {
    const card = await createCard({ card_number: '****t902' })
    const { error } = await supabase
      .from('credit_cards').update({ card_name: 'Đã đổi tên' }).eq('id', card.id)
    expect(error).toBeNull()
    const { data } = await supabase.from('credit_cards').select('card_name').eq('id', card.id).single()
    expect(data?.card_name).toBe('Đã đổi tên')
  })

  it('không đổi user_id thẻ sang người khác (with check)', async () => {
    const card = await createCard({ card_number: '****t903' })
    const { error } = await supabase
      .from('credit_cards')
      .update({ user_id: '00000000-0000-4000-a000-0000000000ff' })
      .eq('id', card.id)
    expect(error?.code).toBe('42501')
  })
})

describe('transactions.mcc', () => {
  it('gán MCC hợp lệ, bỏ MCC bằng null, từ chối sai định dạng', async () => {
    const card = await createCard({ card_number: '****t904' })
    const txId = await addTx(card.id, -100000)

    const ok = await supabase.from('transactions').update({ mcc: '5411' }).eq('id', txId)
    expect(ok.error).toBeNull()
    const read = await supabase.from('transactions').select('mcc').eq('id', txId).single()
    expect(read.data?.mcc).toBe('5411')

    const bad = await supabase.from('transactions').update({ mcc: '54' }).eq('id', txId)
    expect(bad.error?.code).toBe('23514')

    const clear = await supabase.from('transactions').update({ mcc: null }).eq('id', txId)
    expect(clear.error).toBeNull()
  })
})

describe('card_cashback_rules', () => {
  it('ràng buộc: 1 rule mặc định / thẻ, MCC không trùng, % và ngưỡng hợp lệ', async () => {
    const card = await createCard({ card_number: '****t905' })
    const rule = (extra: Record<string, unknown>) =>
      supabase.from('card_cashback_rules').insert({ card_id: card.id, rate_percent: 1, ...extra })

    expect((await rule({ mcc: null })).error).toBeNull()
    expect((await rule({ mcc: null })).error?.code).toBe('23505') // nulls not distinct
    expect((await rule({ mcc: '5812', rate_percent: 5, min_cycle_spend: 1000000, cap_per_cycle: 200000 })).error).toBeNull()
    expect((await rule({ mcc: '5812' })).error?.code).toBe('23505')
    expect((await rule({ mcc: '5411', rate_percent: 101 })).error?.code).toBe('23514')
    expect((await rule({ mcc: '5411', cap_per_cycle: 0 })).error?.code).toBe('23514')
    expect((await rule({ mcc: 'abcd' })).error?.code).toBe('23514')
  })

  it('không gắn rule vào thẻ không tồn tại (thẻ của user khác: xem supabase/tests)', async () => {
    const { error } = await supabase.from('card_cashback_rules').insert({
      card_id: '00000000-0000-4000-c000-0000000000ff', mcc: '5411', rate_percent: 1,
    })
    expect(error?.code).toBe('42501')
  })

  it('anon (chưa đăng nhập) không đọc được rule', async () => {
    const anon = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-anon-test' } }
    )
    // `revoke all ... from anon` -> permission denied (42501) một cách xác định.
    // Không chấp nhận "data rỗng": key sai/mạng lỗi cũng cho data null và sẽ qua oan.
    const read = await anon.from('card_cashback_rules').select('id')
    expect(read.error?.code).toBe('42501')

    const write = await anon.from('card_cashback_rules').insert({
      user_id: userId, card_id: '00000000-0000-4000-c000-0000000000ff', rate_percent: 1,
    })
    expect(write.error?.code).toBe('42501')
  })
})

describe('rpc delete_credit_card', () => {
  it('xoá thẻ kèm toàn bộ giao dịch và rule, trả đúng số giao dịch', async () => {
    const card = await createCard({ card_number: '****t906' })
    await addTx(card.id, -1000)
    await addTx(card.id, -2000)
    await supabase.from('card_cashback_rules').insert({ card_id: card.id, rate_percent: 1 })

    const { data, error } = await supabase.rpc('delete_credit_card', { p_card_id: card.id })
    expect(error).toBeNull()
    expect(data).toBe(2)

    const cards = await supabase.from('credit_cards').select('id').eq('id', card.id)
    const txs = await supabase.from('transactions').select('id').eq('card_id', card.id)
    const rules = await supabase.from('card_cashback_rules').select('id').eq('card_id', card.id)
    expect(cards.data).toHaveLength(0)
    expect(txs.data).toHaveLength(0) // không để giao dịch mồ côi (card_id null)
    expect(rules.data).toHaveLength(0)
  })

  it('thẻ không tồn tại / không thuộc user -> lỗi P0002, không thành công im lặng', async () => {
    const { error } = await supabase.rpc('delete_credit_card', {
      p_card_id: '00000000-0000-4000-c000-0000000000fe',
    })
    expect(error?.code).toBe('P0002')
  })
})
