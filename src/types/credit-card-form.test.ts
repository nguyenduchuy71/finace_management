import { describe, it, expect } from 'vitest'
import {
  CARD_NUMBER_PATTERN, EMPTY_CARD_FORM, cardToFormInput, validateCardForm,
  type CardFormInput,
} from './credit-card-form'

const valid: CardFormInput = {
  bankName: ' LPBank ',
  cardName: 'LPBank Visa',
  cardNumber: '****x265',
  cardType: 'visa',
  statementDate: '5',
  paymentDueDate: '25',
  creditLimit: '50.000.000',
}

describe('CARD_NUMBER_PATTERN', () => {
  it.each(['****x265', '****5678', '****AbC9', '****9%08', '****a_b-'])('chấp nhận %s', (n) => {
    expect(CARD_NUMBER_PATTERN.test(n)).toBe(true)
  })

  // 5678 và ****5678 cùng khớp LIKE '%5678' của edge function -> phải ép một định dạng
  it.each(['5678', '***5678', '*****5678', '****567', '****56789', '****56 8', '**** 5678', ''])(
    'từ chối %j', (n) => {
      expect(CARD_NUMBER_PATTERN.test(n)).toBe(false)
    }
  )
})

describe('validateCardForm', () => {
  it('chuẩn hoá: trim chuỗi, chuyển ngày và hạn mức sang số', () => {
    const r = validateCardForm(valid)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.values).toEqual({
        bankName: 'LPBank', cardName: 'LPBank Visa', cardNumber: '****x265', cardType: 'visa',
        statementDate: 5, paymentDueDate: 25, creditLimit: 50000000,
      })
    }
  })

  it('hạn mức để trống = 0 (SMS ngân hàng không có hạn mức)', () => {
    const r = validateCardForm({ ...valid, creditLimit: '' })
    expect(r.ok && r.values.creditLimit).toBe(0)
  })

  it('form rỗng báo lỗi đúng các ô bắt buộc', () => {
    const r = validateCardForm(EMPTY_CARD_FORM)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        ['bankName', 'cardName', 'cardNumber', 'paymentDueDate', 'statementDate'].sort()
      )
    }
  })

  it.each(['0', '32', '100', 'abc', '1.5', '-3', ''])('ngày sao kê %j không hợp lệ', (d) => {
    const r = validateCardForm({ ...valid, statementDate: d })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.statementDate).toBeTruthy()
  })

  it.each(['1', '31'])('biên ngày %s hợp lệ', (d) => {
    expect(validateCardForm({ ...valid, statementDate: d, paymentDueDate: d }).ok).toBe(true)
  })

  it('hạn mức chữ hoặc quá lớn bị từ chối', () => {
    expect(validateCardForm({ ...valid, creditLimit: '5tr' }).ok).toBe(false)
    expect(validateCardForm({ ...valid, creditLimit: '9'.repeat(20) }).ok).toBe(false)
  })

  // Trước đây "1.5" / "1,5" âm thầm thành 15đ và "1.500.00" thành 150.000đ.
  it.each(['1.5', '1,5', '1.500.00', '12.34', '1..000', '.000', '1.0000', '-5'])(
    'hạn mức sai nhóm nghìn %j bị từ chối thay vì đoán', (v) => {
      const r = validateCardForm({ ...valid, creditLimit: v })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.creditLimit).toMatch(/sai định dạng/)
    }
  )

  it.each([['50000000', 50000000], ['50.000.000', 50000000], ['50,000,000', 50000000],
    ['50 000 000', 50000000], ['999', 999], ['1.000', 1000], ['0', 0]])(
    'hạn mức %j hợp lệ = %i', (v, want) => {
      const r = validateCardForm({ ...valid, creditLimit: v })
      expect(r.ok && r.values.creditLimit).toBe(want)
    }
  )

  it('loại thẻ lạ bị từ chối, amex được chấp nhận', () => {
    expect(validateCardForm({ ...valid, cardType: 'amex' }).ok).toBe(true)
    expect(validateCardForm({ ...valid, cardType: 'diners' as never }).ok).toBe(false)
  })
})

describe('cardToFormInput', () => {
  it('đi một vòng thẻ -> form -> giá trị không đổi', () => {
    const card = {
      id: 'c1', bankName: 'SHB', cardName: 'SHB Visa', cardNumber: '****x265',
      cardType: 'mastercard' as const, currency: 'VND' as const, creditLimit: 12000000,
      currentBalance: 0, statementDate: 9, paymentDueDate: 29, lastUpdated: '2026-01-01T00:00:00Z',
    }
    const r = validateCardForm(cardToFormInput(card))
    expect(r.ok && r.values).toMatchObject({
      bankName: 'SHB', cardNumber: '****x265', cardType: 'mastercard',
      statementDate: 9, paymentDueDate: 29, creditLimit: 12000000,
    })
  })
})
