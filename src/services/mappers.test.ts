import { describe, it, expect } from 'vitest'
import { mapCreditCardTransaction, type TransactionRow } from './mappers'

describe('mapCreditCardTransaction — mcc', () => {
  const row: TransactionRow = {
    id: 't1', bank_name: 'SHB', amount: -50000, currency: 'VND',
    transaction_date: '2026-08-05T03:00:00+00:00', description: 'GRAB', raw_text: null,
    created_at: '2026-08-05T03:00:00+00:00', user_id: 'u1', source_type: 'credit_card',
    account_ref: null, account_id: null, card_id: 'c1', merchant_name: 'GRAB',
    category: null, status: 'posted',
  }

  it('map mcc từ DB sang camelCase', () => {
    expect(mapCreditCardTransaction({ ...row, mcc: '4121' }).mcc).toBe('4121')
  })

  it('chưa phân loại (null hoặc thiếu cột) -> undefined, không phải chuỗi rỗng', () => {
    expect(mapCreditCardTransaction({ ...row, mcc: null }).mcc).toBeUndefined()
    expect(mapCreditCardTransaction(row).mcc).toBeUndefined()
  })

  it('MCC sai định dạng từ DB bị Zod chặn ở service boundary', () => {
    expect(() => mapCreditCardTransaction({ ...row, mcc: 'abc' })).toThrow()
  })
})
