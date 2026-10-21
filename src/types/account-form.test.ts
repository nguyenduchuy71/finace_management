import { describe, expect, it } from 'vitest'
import { EMPTY_ACCOUNT_FORM, validateAccountForm } from './account-form'

const valid = {
  ...EMPTY_ACCOUNT_FORM,
  bankName: 'Vietinbank', accountName: 'TK lương', accountNumber: '****4982',
}

describe('validateAccountForm', () => {
  it('hợp lệ: số dư trống = 0, mask chữ như LPBank ****x265', () => {
    expect(validateAccountForm(valid)).toEqual({
      ok: true,
      values: { bankName: 'Vietinbank', accountName: 'TK lương', accountNumber: '****4982', accountType: 'checking', balance: 0 },
    })
    expect(validateAccountForm({ ...valid, accountNumber: '****x265' }).ok).toBe(true)
  })

  it.each(['104885084982', '4982', '***4982', '****49821', '**** 982'])(
    'số TK %s sai mask -> lỗi tại ô số TK', (accountNumber) => {
      const r = validateAccountForm({ ...valid, accountNumber })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.accountNumber).toMatch(/\*\*\*\*/)
    })

  it('báo lỗi từng ô bắt buộc và số dư sai định dạng', () => {
    const r = validateAccountForm({ ...EMPTY_ACCOUNT_FORM, balance: '1.5' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['accountName', 'accountNumber', 'balance', 'bankName'])
    }
  })
})
