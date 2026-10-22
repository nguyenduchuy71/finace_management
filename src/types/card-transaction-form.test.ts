import { describe, it, expect } from 'vitest'
import { initialCardTxForm, toCardTxPatch, type CardTxFormInput } from './card-transaction-form'
import type { CreditCardTransaction } from './creditCard'

const tx: CreditCardTransaction = {
  id: 'tx-1', cardId: 'c1', amount: -150_000, description: 'GD THE 1234 WINMART',
  merchantName: 'WINMART HCM', type: 'purchase', status: 'posted', kind: 'normal',
  // 23:30:45 UTC = 06:30 ngày hôm sau giờ VN
  transactionDate: '2026-03-08T23:30:45Z',
}
const initial = initialCardTxForm(tx)
const patchOf = (change: Partial<CardTxFormInput>) => toCardTxPatch({ ...initial, ...change }, initial)

describe('initialCardTxForm', () => {
  it('điền từ giao dịch: số tiền dương + chiều, giờ VN tới phút', () => {
    expect(initial).toEqual({
      merchantName: 'WINMART HCM', description: 'GD THE 1234 WINMART', kind: 'normal',
      direction: 'expense', amount: '150000', localDateTime: '2026-03-09T06:30', category: '', mcc: '',
    })
  })

  it('tiền vào thẻ: chiều income', () => {
    expect(initialCardTxForm({ ...tx, amount: 5_000_000 }).direction).toBe('income')
  })
})

describe('toCardTxPatch', () => {
  it('không đổi gì: patch rỗng (không ghi đè giây của thời điểm)', () => {
    expect(patchOf({})).toEqual({ ok: true, patch: {} })
  })

  it('chỉ gửi trường đã đổi', () => {
    expect(patchOf({ merchantName: 'WinMart+ Q1' })).toEqual({ ok: true, patch: { merchantName: 'WinMart+ Q1' } })
  })

  it('đổi số tiền: gửi số có dấu theo chiều; nhận nhóm nghìn', () => {
    expect(patchOf({ amount: '200.000' })).toEqual({ ok: true, patch: { amount: -200_000 } })
  })

  it('chỉ đổi chiều: vẫn gửi lại số tiền với dấu mới', () => {
    expect(patchOf({ direction: 'income' })).toEqual({ ok: true, patch: { amount: 150_000 } })
  })

  it('đổi thời điểm: ISO có offset +07:00', () => {
    expect(patchOf({ localDateTime: '2026-03-10T08:15' })).toEqual({
      ok: true, patch: { transactionDate: '2026-03-10T08:15:00+07:00' },
    })
  })

  it('xoá trắng ô chữ / danh mục / MCC thì gửi null', () => {
    const withValues = { ...initial, category: 'Mua sắm', mcc: '5411' } as CardTxFormInput
    const r = toCardTxPatch({ ...withValues, merchantName: '  ', category: '', mcc: '' }, withValues)
    expect(r).toEqual({ ok: true, patch: { merchantName: null, category: null, mcc: null } })
  })

  it('đổi loại, danh mục, MCC', () => {
    expect(patchOf({ kind: 'internal_transfer', category: 'Hóa đơn', mcc: '4900' })).toEqual({
      ok: true, patch: { kind: 'internal_transfer', category: 'Hóa đơn', mcc: '4900' },
    })
  })

  it.each([
    [{ amount: '0' }, 'amount'], [{ amount: '1.5' }, 'amount'], [{ amount: '' }, 'amount'],
    [{ localDateTime: '' }, 'localDateTime'], [{ mcc: '123' }, 'mcc'],
    [{ merchantName: 'x'.repeat(201) }, 'merchantName'],
    [{ category: 'Linh tinh' } as unknown as Partial<CardTxFormInput>, 'category'],
  ])('dữ liệu sai %j: lỗi ở ô %s', (change, key) => {
    const r = patchOf(change)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual([key])
  })

  it('cashback mà chiều chi: báo lỗi ở ô chiều tiền', () => {
    const r = patchOf({ kind: 'cashback' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.direction).toMatch(/Cashback là tiền vào/)
  })
})
