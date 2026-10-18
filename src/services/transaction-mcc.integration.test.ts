import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getCreditCardTransactions, updateCardTransactionMcc } from './creditCards'
import { exportTransactions } from './exports'

// Service MCC chạy trên Supabase local THẬT (Zod, RLS, cột mcc, TX_COLUMNS). Dùng chung DB
// với các file integration khác (assert tổng cố định theo seed) nên mọi dữ liệu tạo ở đây
// đều được dọn, kể cả khi test fail giữa chừng.

const BANK = 'MccBank'
let userId = ''
let cardId = ''
let txId = ''

async function cleanup() {
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  for (const c of data ?? []) await supabase.rpc('delete_credit_card', { p_card_id: c.id })
}

const mccOfTx = async () => {
  const page = await getCreditCardTransactions(cardId)
  return page.data.find((t) => t.id === txId)?.mcc
}

beforeAll(async () => {
  userId = (await supabase.auth.getUser()).data.user!.id
  await cleanup() // một lần chạy trước bị crash có thể để lại thẻ

  const card = await supabase.from('credit_cards').insert({
    bank_name: BANK, card_name: 'Thẻ MCC test', card_number: '****q001', card_type: 'visa',
    statement_date: 10, payment_due_date: 28,
  }).select('id').single()
  if (card.error) throw card.error
  cardId = card.data.id

  const tx = await supabase.from('transactions').insert({
    user_id: userId, bank_name: BANK, amount: -120000, merchant_name: 'WINMART HCM',
    description: 'WINMART HCM', transaction_date: new Date().toISOString(),
    source_type: 'credit_card', card_id: cardId,
  }).select('id').single()
  if (tx.error) throw tx.error
  txId = tx.data.id
})

afterAll(async () => {
  await cleanup()
  const { data } = await supabase.from('credit_cards').select('id').eq('bank_name', BANK)
  if ((data ?? []).length > 0) throw new Error('Dọn thẻ test thất bại: còn thẻ MccBank')
})

describe('updateCardTransactionMcc', () => {
  it('giao dịch mới chưa có MCC', async () => {
    expect(await mccOfTx()).toBeUndefined()
  })

  it('gán MCC rồi đọc lại qua getCreditCardTransactions', async () => {
    await updateCardTransactionMcc(txId, '5411')
    expect(await mccOfTx()).toBe('5411')
  })

  it('đổi sang MCC khác', async () => {
    await updateCardTransactionMcc(txId, '5812')
    expect(await mccOfTx()).toBe('5812')
  })

  it('export CSV mang theo MCC', async () => {
    const res = await exportTransactions(null, { cardId })
    expect(res.data.find((t) => t.id === txId)).toMatchObject({ mcc: '5812' })
  })

  it('null bỏ phân loại', async () => {
    await updateCardTransactionMcc(txId, null)
    expect(await mccOfTx()).toBeUndefined()
  })

  it.each(['abc', '541', '54111', '', '54 1'])('MCC sai định dạng %j bị chặn trước khi gọi DB', async (bad) => {
    await expect(updateCardTransactionMcc(txId, bad)).rejects.toMatchObject({ code: 'INVALID_MCC' })
    expect(await mccOfTx()).toBeUndefined()
  })

  it('giao dịch không tồn tại -> NOT_FOUND, không "lưu thành công" im lặng', async () => {
    await expect(updateCardTransactionMcc('00000000-0000-4000-a000-0000000000fb', '5411'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('DB cũng chặn MCC sai định dạng nếu service bị qua mặt', async () => {
    const { error } = await supabase.from('transactions').update({ mcc: '12' }).eq('id', txId)
    expect(error?.code).toBe('23514')
  })
})
