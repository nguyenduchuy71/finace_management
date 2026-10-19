import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/lib/supabase'
import {
  listCashbackRules, createCashbackRule, updateCashbackRule, deleteCashbackRule, getCycleExpenses,
} from './cashbackRules'
import { computeCashback } from '@/utils/cashback'
import type { CashbackFormValues } from '@/types/cashback-form'

// Service rule hoàn tiền chạy trên Supabase local THẬT (RLS, ràng buộc, Zod, phân trang chu kỳ).
// Dùng chung DB với các file integration khác (assert tổng cố định theo seed) nên mọi dữ liệu
// tạo ở đây đều được dọn, kể cả khi test fail giữa chừng.

const BANK = 'CashBank'
const values = (over: Partial<CashbackFormValues> = {}): CashbackFormValues => ({
  mcc: null, ratePercent: 1, minCycleSpend: 0, capPerCycle: null, ...over,
})

let userId = ''
let cardId = ''

async function cleanup() {
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  for (const c of data ?? []) await supabase.rpc('delete_credit_card', { p_card_id: c.id })
}

async function addTx(amount: number, at: string, mcc?: string) {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId, bank_name: BANK, amount, transaction_date: at, source_type: 'credit_card',
    card_id: cardId, merchant_name: 'x', mcc: mcc ?? null,
  })
  if (error) throw error
}

beforeAll(async () => {
  userId = (await supabase.auth.getUser()).data.user!.id
  await cleanup() // một lần chạy trước bị crash có thể để lại thẻ

  const card = await supabase.from('credit_cards').insert({
    bank_name: BANK, card_name: 'Thẻ cashback test', card_number: '****k001', card_type: 'visa',
    statement_date: 10, payment_due_date: 28,
  }).select('id').single()
  if (card.error) throw card.error
  cardId = card.data.id
})

afterAll(async () => {
  await cleanup()
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  if ((data ?? []).length > 0) throw new Error('Dọn thẻ test thất bại: còn thẻ CashBank')
})

describe('cashback rules CRUD', () => {
  it('thẻ mới chưa có rule', async () => {
    expect(await listCashbackRules(cardId)).toEqual([])
  })

  it('tạo rule: map đúng kiểu số, không rò string của numeric/bigint', async () => {
    const r = await createCashbackRule(cardId, values({ mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000 }))
    expect(r).toMatchObject({ cardId, mcc: '5812', ratePercent: 5.5, minCycleSpend: 3_000_000, capPerCycle: 200_000 })
    expect(typeof r.ratePercent).toBe('number')
    expect(typeof r.minCycleSpend).toBe('number')
  })

  it('rule mặc định: mcc null, không trần', async () => {
    const r = await createCashbackRule(cardId, values({ mcc: null, ratePercent: 0.29 }))
    expect(r).toMatchObject({ mcc: null, ratePercent: 0.29, capPerCycle: null, minCycleSpend: 0 })
  })

  it('list: rule theo MCC trước, rule mặc định cuối cùng', async () => {
    const list = await listCashbackRules(cardId)
    expect(list.map((r) => r.mcc)).toEqual(['5812', null])
  })

  it('trùng nhóm MCC -> thông điệp riêng, kể cả hai rule mặc định (nulls not distinct)', async () => {
    await expect(createCashbackRule(cardId, values({ mcc: '5812' })))
      .rejects.toMatchObject({ code: '23505', message: expect.stringContaining('đã có rule') })
    await expect(createCashbackRule(cardId, values({ mcc: null })))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('sửa rule', async () => {
    const [food] = await listCashbackRules(cardId)
    const updated = await updateCashbackRule(food.id, values({ mcc: '5812', ratePercent: 6, minCycleSpend: 0, capPerCycle: null }))
    expect(updated).toMatchObject({ id: food.id, ratePercent: 6, minCycleSpend: 0, capPerCycle: null })
  })

  it('đổi sang nhóm đã có rule khác -> 23505', async () => {
    const list = await listCashbackRules(cardId)
    const food = list.find((r) => r.mcc === '5812')!
    await expect(updateCashbackRule(food.id, values({ mcc: null }))).rejects.toMatchObject({ code: '23505' })
  })

  it('sửa rule không tồn tại -> lỗi, không "thành công" im lặng', async () => {
    await expect(updateCashbackRule('00000000-0000-4000-a000-0000000000fa', values())).rejects.toHaveProperty('code')
  })

  it('DB chặn % ngoài 0..100 và trần 0 nếu form bị qua mặt', async () => {
    const bad = (extra: Record<string, unknown>) =>
      supabase.from('card_cashback_rules').insert({ card_id: cardId, mcc: '5411', rate_percent: 1, ...extra })
    expect((await bad({ rate_percent: 101 })).error?.code).toBe('23514')
    expect((await bad({ cap_per_cycle: 0 })).error?.code).toBe('23514')
    expect((await bad({ min_cycle_spend: -1 })).error?.code).toBe('23514')
  })

  it('xoá rule; xoá lại -> NOT_FOUND (RLS lọc 0 dòng không được báo thành công)', async () => {
    const r = await createCashbackRule(cardId, values({ mcc: '5411' }))
    await deleteCashbackRule(r.id)
    expect((await listCashbackRules(cardId)).map((x) => x.mcc)).not.toContain('5411')
    await expect(deleteCashbackRule(r.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('xoá thẻ kéo theo xoá rule (cascade)', async () => {
    const card = await supabase.from('credit_cards').insert({
      bank_name: BANK, card_name: 'Thẻ tạm', card_number: '****k002', card_type: 'visa',
      statement_date: 5, payment_due_date: 25,
    }).select('id').single()
    if (card.error) throw card.error
    await createCashbackRule(card.data.id, values({ mcc: '5812' }))
    await supabase.rpc('delete_credit_card', { p_card_id: card.data.id })
    const { data } = await supabase.from('card_cashback_rules').select('id').eq('card_id', card.data.id)
    expect(data).toHaveLength(0)
  })
})

describe('getCycleExpenses — biên chu kỳ nửa mở [start, end)', () => {
  // Chu kỳ sao kê ngày 10: bắt đầu 00:00 VN ngày 11/03 = 2026-03-10T17:00:00Z, kết thúc trước
  // 00:00 VN ngày 11/04 = 2026-04-10T17:00:00Z.
  const START = '2026-03-10T17:00:00.000Z'
  const END = '2026-04-10T17:00:00.000Z'

  it('chỉ lấy giao dịch CHI thuộc chu kỳ, đúng biên', async () => {
    await addTx(-1_000, '2026-03-10T16:59:59Z') // ngay TRƯỚC biên đầu -> kỳ trước
    await addTx(-2_000, START)                    // đúng biên đầu -> THUỘC kỳ này
    await addTx(-3_000, '2026-03-25T05:00:00Z')   // giữa kỳ
    await addTx(-4_000, '2026-04-10T16:59:59Z')   // ngay trước biên cuối -> THUỘC
    await addTx(-5_000, END)                      // đúng biên cuối -> kỳ SAU
    await addTx(900_000, '2026-03-26T05:00:00Z')  // giao dịch dương (thanh toán) -> loại

    const got = await getCycleExpenses(cardId, START, END)
    expect(got.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-4_000, -3_000, -2_000])
  })

  it('chu kỳ trống thì trả mảng rỗng', async () => {
    expect(await getCycleExpenses(cardId, '2030-01-01T00:00:00Z', '2030-02-01T00:00:00Z')).toEqual([])
  })

  it('lật trang đủ khi chu kỳ có nhiều hơn một trang (>500 giao dịch)', async () => {
    const rows = Array.from({ length: 620 }, (_, i) => ({
      user_id: userId, bank_name: BANK, amount: -1_000, source_type: 'credit_card', card_id: cardId,
      merchant_name: 'bulk', mcc: '5411',
      transaction_date: new Date(Date.UTC(2026, 5, 1, 0, 0, i)).toISOString(),
    }))
    const ins = await supabase.from('transactions').insert(rows)
    if (ins.error) throw ins.error

    const got = await getCycleExpenses(cardId, '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z')
    expect(got).toHaveLength(620)
    expect(new Set(got.map((t) => t.id)).size).toBe(620) // không trùng/thiếu giữa các trang
    expect(got.every((t) => t.mcc === '5411')).toBe(true)
  })
})

describe('end-to-end: rule + giao dịch thật -> computeCashback', () => {
  it('ra đúng số tiền hoàn từ dữ liệu đọc về từ DB', async () => {
    // Rule hiện có của thẻ: 5812 = 6% (không ngưỡng/trần); mặc định = 0.29%.
    await addTx(-2_000_000, '2026-08-05T00:00:00Z', '5812')
    await addTx(-1_000_000, '2026-08-06T00:00:00Z')
    const rules = await listCashbackRules(cardId)
    const txs = await getCycleExpenses(cardId, '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z')
    const r = computeCashback(rules, txs)
    // 6% × 2.000.000 = 120.000 ; 0,29% × 1.000.000 = 2.900
    expect(r.total).toBe(122_900)
    expect(r.unmatchedSpend).toBe(0)
  })
})
