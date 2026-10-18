import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/lib/supabase'
import {
  createCreditCard, updateCreditCard, countCardTransactions, deleteCreditCard,
} from './credit-card-mutations'
import { getCreditCards } from './creditCards'
import { getUnlinkedCount } from './accounts'
import type { CardFormValues } from '@/types/credit-card-form'

// Kiểm service THẬT (mapper, Zod, RLS, RPC) trên Supabase local. Dùng chung DB với các
// file integration khác (assert tổng cố định theo seed) nên mọi thẻ/giao dịch tạo ở đây
// đều được dọn, kể cả khi test fail giữa chừng.

const BANK = 'MutBank'
const values = (overrides: Partial<CardFormValues> = {}): CardFormValues => ({
  bankName: BANK, cardName: 'Thẻ mutation test', cardNumber: '****m001', cardType: 'visa',
  statementDate: 12, paymentDueDate: 30, creditLimit: 25000000, ...overrides,
})

let userId = ''
const createdIds: string[] = []

async function create(overrides: Partial<CardFormValues> = {}) {
  const card = await createCreditCard(values(overrides))
  createdIds.push(card.id)
  return card
}

async function addTx(cardId: string, amount: number) {
  const { error } = await supabase.from('transactions').insert({
    user_id: userId, bank_name: BANK, amount, transaction_date: new Date().toISOString(),
    source_type: 'credit_card', card_id: cardId,
  })
  if (error) throw error
}

async function cleanup() {
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  for (const c of data ?? []) await supabase.rpc('delete_credit_card', { p_card_id: c.id })
}

beforeAll(async () => {
  userId = (await supabase.auth.getUser()).data.user!.id
  await cleanup() // một lần chạy trước bị crash có thể để lại thẻ
})

afterAll(async () => {
  await cleanup()
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  if ((data ?? []).length > 0) throw new Error('Dọn thẻ test thất bại: còn thẻ MutBank')
})

describe('createCreditCard', () => {
  it('tạo thẻ, map đúng camelCase và số nguyên, mặc định VND / số dư 0', async () => {
    const card = await create()
    expect(card).toMatchObject({
      bankName: BANK, cardNumber: '****m001', cardType: 'visa', currency: 'VND',
      creditLimit: 25000000, currentBalance: 0, statementDate: 12, paymentDueDate: 30,
    })
    expect(typeof card.creditLimit).toBe('number') // bigint không được rò ra dạng string
  })

  it('thẻ mới xuất hiện trong getCreditCards', async () => {
    const card = await create({ cardNumber: '****m002' })
    const list = await getCreditCards()
    expect(list.data.map((c) => c.id)).toContain(card.id)
  })

  it('trùng (ngân hàng, số thẻ) -> ApiError 23505', async () => {
    await create({ cardNumber: '****m003' })
    await expect(createCreditCard(values({ cardNumber: '****m003' })))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('hỗ trợ thẻ amex (khớp constraint card_type ở DB)', async () => {
    const card = await create({ cardNumber: '****m004', cardType: 'amex' })
    expect(card.cardType).toBe('amex')
  })
})

describe('updateCreditCard', () => {
  it('sửa thẻ và trả về giá trị mới', async () => {
    const card = await create({ cardNumber: '****m005' })
    const updated = await updateCreditCard(card.id, values({
      cardNumber: '****m005', cardName: 'Đã đổi tên', creditLimit: 99000000, statementDate: 1,
    }))
    expect(updated).toMatchObject({ id: card.id, cardName: 'Đã đổi tên', creditLimit: 99000000, statementDate: 1 })
  })

  it('sửa thẻ không tồn tại -> ApiError (không thành công im lặng)', async () => {
    await expect(updateCreditCard('00000000-0000-4000-c000-0000000000fd', values()))
      .rejects.toHaveProperty('code')
  })

  it('đổi số thẻ sang số đã có của thẻ khác -> 23505', async () => {
    await create({ cardNumber: '****m006' })
    const other = await create({ cardNumber: '****m007' })
    await expect(updateCreditCard(other.id, values({ cardNumber: '****m006' })))
      .rejects.toMatchObject({ code: '23505' })
  })
})

describe('countCardTransactions + deleteCreditCard', () => {
  it('đếm đúng giao dịch của thẻ', async () => {
    const card = await create({ cardNumber: '****m008' })
    expect(await countCardTransactions(card.id)).toBe(0)
    await addTx(card.id, -1000)
    await addTx(card.id, -2000)
    expect(await countCardTransactions(card.id)).toBe(2)
  })

  it('xoá thẻ kèm giao dịch, trả đúng số; không để giao dịch mồ côi', async () => {
    const card = await create({ cardNumber: '****m009' })
    await addTx(card.id, -1000)
    await addTx(card.id, -2000)
    await addTx(card.id, -3000)
    const unlinkedBefore = await getUnlinkedCount()

    expect(await deleteCreditCard(card.id)).toBe(3)

    expect((await getCreditCards()).data.map((c) => c.id)).not.toContain(card.id)
    expect(await countCardTransactions(card.id)).toBe(0)
    expect(await getUnlinkedCount()).toBe(unlinkedBefore) // không sinh giao dịch card_id null
  })

  it('xoá thẻ không tồn tại -> ApiError P0002 kèm thông điệp tiếng Việt', async () => {
    await expect(deleteCreditCard('00000000-0000-4000-c000-0000000000fc'))
      .rejects.toMatchObject({ code: 'P0002', message: expect.stringContaining('Không tìm thấy thẻ') })
  })
})
