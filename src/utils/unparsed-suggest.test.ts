import { describe, expect, it } from 'vitest'
import { suggestFromText, vnLocalToISO } from './unparsed-suggest'

// 21/10/2026 09:30 giờ VN
const RECEIVED = '2026-10-21T02:30:00.000Z'

describe('suggestFromText', () => {
  it('tin có dấu, ngày giờ đủ năm, đuôi TK (mẫu chưa có parser)', () => {
    const s = suggestFromText(
      '-10,000 VND\nTài khoản: 800xx0300\nSố dư: 0 VND\nND: CK 24/7 cho 0349000265-NGUYEN VAN AN chuyen tien',
      RECEIVED,
    )
    expect(s).toEqual({ amount: 10000, direction: 'expense', localDateTime: '2026-10-21T09:30', ref: '0300' })
  })

  it('"+  VND 10,000" và mask **0265', () => {
    const s = suggestFromText(
      'Thông báo ghi có\nTài khoản **0265 thay đổi +  VND 10,000.\nSố dư khả dụng: VND 97,600.',
      RECEIVED,
    )
    expect(s.amount).toBe(10000)
    expect(s.direction).toBe('income')
    expect(s.ref).toBe('0265')
  })

  it('ngày thiếu năm lấy năm của thời điểm nhận', () => {
    const s = suggestFromText(
      'Thông báo biến động số dư\n20/10 11:30 Tài khoản: 0349000265 Số tiền: -199.000 VND',
      RECEIVED,
    )
    expect(s.localDateTime).toBe('2026-10-20T11:30')
    expect(s.amount).toBe(199000)
    expect(s.direction).toBe('expense')
  })

  it('giờ trước ngày ("lúc 10:11 19/10/2026") và thẻ ••9526', () => {
    const s = suggestFromText('-48.750 đ\nTài khoản tín dụng, thẻ ••9526\nTại Grab, lúc 10:11 19/10/2026', RECEIVED)
    expect(s).toEqual({ amount: 48750, direction: 'expense', localDateTime: '2026-10-19T10:11', ref: '9526' })
  })

  it('số tiền không dấu -> không đoán chiều', () => {
    const s = suggestFromText('Bạn đã thực hiện thanh toán thành công cho QUÁN X với số tiền 15.000đ.', RECEIVED)
    expect(s.amount).toBe(15000)
    expect(s.direction).toBeUndefined()
    expect(s.ref).toBeUndefined()
  })

  it('không nhầm % lãi suất / "điểm" là số tiền', () => {
    expect(suggestFromText('+2.2% lãi suất khi bạn quay lại', RECEIVED).amount).toBeUndefined()
    expect(suggestFromText('Thưởng +10,000 điểm', RECEIVED).amount).toBeUndefined()
  })

  it('không có gì -> chỉ thời điểm nhận', () => {
    expect(suggestFromText('Thông báo VPBank\nQuý khách có thông báo biến động số dư mới', RECEIVED))
      .toEqual({ localDateTime: '2026-10-21T09:30' })
  })
})

describe('vnLocalToISO', () => {
  it('gắn offset +07:00 để RPC nhận', () => {
    expect(vnLocalToISO('2026-10-19T16:35')).toBe('2026-10-19T16:35:00+07:00')
    expect(new Date(vnLocalToISO('2026-10-19T16:35')).toISOString()).toBe('2026-10-19T09:35:00.000Z')
  })
})

describe('suggestFromText — số không dấu', () => {
  it('bỏ qua số dư / hạn mức đứng trước số tiền giao dịch', () => {
    expect(suggestFromText('Số dư: 545,832 VND. Số tiền: 499,000 VND', RECEIVED).amount).toBe(499000)
    expect(suggestFromText('Hạn mức khả dụng: 41,800,000 VND. Đã thanh toán 199,000 VND', RECEIVED).amount).toBe(199000)
  })
  it('không cắt giữa số: "1234.567 VND" không thành 234567', () => {
    expect(suggestFromText('Thanh toán 1234.567 VND', RECEIVED).amount).not.toBe(234567)
  })
})

describe('suggestFromText — năm của tin không ghi năm', () => {
  const OCB = (ddmm: string) => `Thông báo biến động số dư\n${ddmm} 23:58\nTài khoản: 0349000265\nSố tiền: -10.000 VND`
  it('tin 31/12 nhận ngay sau giao thừa thuộc năm cũ (khớp inferYear của server)', () => {
    expect(suggestFromText(OCB('31/12'), '2026-12-31T17:01:00Z').localDateTime).toBe('2026-12-31T23:58')
  })
  it('tin trong năm không bị lùi nhầm', () => {
    expect(suggestFromText(OCB('20/10'), RECEIVED).localDateTime).toBe('2026-10-20T23:58')
  })
  it('tin có năm giữ nguyên năm của tin', () => {
    expect(suggestFromText('Thời gian: 20/10/2027 17:32\nTài khoản: 1', RECEIVED).localDateTime).toBe('2027-10-20T17:32')
  })
})

describe('suggestFromText — ngày không tồn tại', () => {
  it('29/02 năm không nhuận / 31/04 -> giữ thời điểm nhận tin', () => {
    expect(suggestFromText('Thời gian: 29/02/2027 10:00\nTài khoản: 1', RECEIVED).localDateTime).toBe('2026-10-21T09:30')
    expect(suggestFromText('lúc 10:00 31/04/2026', RECEIVED).localDateTime).toBe('2026-10-21T09:30')
  })
  it('29/02 năm nhuận vẫn nhận', () => {
    expect(suggestFromText('Thời gian: 29/02/2028 10:00\nTài khoản: 1', RECEIVED).localDateTime).toBe('2028-02-29T10:00')
  })
})
