import { describe, expect, it } from 'vitest'
import { initialResolveForm, matchSourceByRef, validateResolveForm } from './resolve-form'

const SUG = { amount: 84000, direction: 'expense' as const, localDateTime: '2026-10-19T16:35', ref: '3946' }

describe('initialResolveForm', () => {
  it('điền sẵn từ gợi ý', () => {
    expect(initialResolveForm(SUG, 'normal', 'account:a1')).toEqual({
      kind: 'normal', source: 'account:a1', direction: 'expense', amount: '84000',
      localDateTime: '2026-10-19T16:35', description: '',
    })
  })
  it('không có dấu: cashback mặc định là thu, còn lại là chi', () => {
    const s = { localDateTime: '2026-10-19T16:35' }
    expect(initialResolveForm(s, 'cashback', '').direction).toBe('income')
    expect(initialResolveForm(s, 'internal_transfer', '').direction).toBe('expense')
    expect(initialResolveForm(s, 'normal', '').amount).toBe('')
  })
})

describe('validateResolveForm', () => {
  const base = initialResolveForm(SUG, 'normal', 'account:a1')

  it('chi -> số âm, ngày giờ VN -> ISO +07:00, gửi accountId', () => {
    expect(validateResolveForm({ ...base, description: '  chuyển khoản ' })).toEqual({
      ok: true, kind: 'normal',
      tx: { amount: -84000, transactionDate: '2026-10-19T16:35:00+07:00', description: 'chuyển khoản', accountId: 'a1' },
    })
  })

  it('thu vào thẻ -> số dương, gửi cardId, mô tả trống thì bỏ', () => {
    const r = validateResolveForm({ ...base, direction: 'income', source: 'card:c9', amount: '100.000' })
    expect(r).toEqual({
      ok: true, kind: 'normal',
      tx: { amount: 100000, transactionDate: '2026-10-19T16:35:00+07:00', cardId: 'c9' },
    })
  })

  it('báo lỗi: chưa chọn nguồn, số tiền 0, ngày trống', () => {
    const r = validateResolveForm({ ...base, source: '', amount: '0', localDateTime: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['amount', 'localDateTime', 'source'])
  })

  it('không đoán số tiền mơ hồ "1.5"', () => {
    const r = validateResolveForm({ ...base, amount: '1.5' })
    expect(r.ok).toBe(false)
  })
})

describe('matchSourceByRef', () => {
  const accounts = [{ id: 'a1', accountNumber: '****3946' }, { id: 'a2', accountNumber: '****0265' }]
  const cards = [{ id: 'c1', cardNumber: '****9526' }, { id: 'c2', cardNumber: '****0265' }]
  it('khớp duy nhất -> chọn sẵn', () => {
    expect(matchSourceByRef('3946', accounts, cards)).toBe('account:a1')
    expect(matchSourceByRef('9526', accounts, cards)).toBe('card:c1')
  })
  it('khớp nhiều hoặc không khớp / không có ref -> để user chọn', () => {
    expect(matchSourceByRef('0265', accounts, cards)).toBe('')
    expect(matchSourceByRef('1111', accounts, cards)).toBe('')
    expect(matchSourceByRef(undefined, accounts, cards)).toBe('')
  })
})

describe('validateResolveForm — cashback', () => {
  it('cashback chiều chi -> lỗi tại ô chiều tiền', () => {
    const r = validateResolveForm({ ...initialResolveForm(SUG, 'cashback', 'card:c1'), direction: 'expense' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.direction).toMatch(/tiền vào/)
  })
  it('cashback chiều thu -> số dương', () => {
    const r = validateResolveForm({ ...initialResolveForm(SUG, 'cashback', 'card:c1'), direction: 'income' })
    expect(r.ok && r.tx.amount).toBe(84000)
  })
})
