import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor, mapCreditCardTransaction, type TransactionRow } from './mappers'

describe('decodeCursor — chặn injection vào filter PostgREST', () => {
  // Các định dạng timestamptz PostgREST thật sự trả về
  it.each([
    '2026-08-05T03:00:00+00:00',
    '2026-08-05T03:00:00Z',
    '2026-08-05T03:00:00.123456+00:00',
    '2026-08-05 03:00:00+00',
    '2026-09-07T15:08:00+07:00',
  ])('accepts real PostgREST date: %s', (date) => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const c = encodeCursor({ transaction_date: date, id })
    const d = decodeCursor(c)
    expect(d).not.toBeNull()
    expect(d!.date).toBe(date)
    expect(d!.id).toBe(id)
  })

  it.each([
    ['2020-01-01,id.not.is.null', 'injection qua date'],
    ['2020-01-01', 'thieu time'],
    ['not-a-date', 'rac'],
  ])('rejects bad date: %s (%s)', (date) => {
    const c = encodeCursor({ transaction_date: date, id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(decodeCursor(c)).toBeNull()
  })

  it('rejects bad id', () => {
    const c = encodeCursor({ transaction_date: '2026-08-05T03:00:00+00:00', id: 'x,or=(a.eq.1)' })
    expect(decodeCursor(c)).toBeNull()
  })
})

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
