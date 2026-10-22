import { describe, it, expect } from 'vitest'
import { COMMON_MCC_OPTIONS } from './mcc'
import { getMccGroup, searchMcc } from './mcc-search'

const codes = (q: string, limit?: number) => searchMcc(q, limit).map((o) => o.code)

describe('searchMcc', () => {
  it('ô tìm trống: các mã hay gặp', () => {
    expect(codes('')).toEqual(COMMON_MCC_OPTIONS.slice(0, 50).map((o) => o.code))
    expect(codes('   ')).toEqual(codes(''))
  })

  it('gõ đúng mã: mã đó đứng đầu', () => {
    expect(codes('7011')[0]).toBe('7011')
  })

  it('gõ đầu mã: các mã bắt đầu bằng chuỗi đó, theo mã tăng dần', () => {
    expect(codes('581')).toEqual(['5811', '5812', '5813', '5814', '5815', '5816', '5817', '5818'])
  })

  it('không dấu, không phân biệt hoa thường', () => {
    expect(codes('KHÁCH SẠN')).toContain('7011')
    expect(codes('khach san')).toContain('7011')
    expect(codes('nha thuoc')).toContain('5912')
  })

  it('mã nhóm chung đứng trước mã riêng của từng hãng', () => {
    expect(codes('khach san')[0]).toBe('7011')
    expect(codes('hang khong')[0]).toBe('4511')
  })

  it('khớp cả từ khoá merchant và tên hãng 3000–3999', () => {
    expect(codes('grab')).toContain('4121')
    expect(codes('singapore airlines')).toEqual(['3075'])
  })

  it('cắt ở limit', () => {
    expect(codes('khach san', 5)).toHaveLength(5)
  })

  it('không khớp gì: rỗng', () => {
    expect(codes('zzzqqq')).toEqual([])
  })
})

describe('getMccGroup', () => {
  it.each([
    ['0742', 'Nông nghiệp'], ['3005', 'Hãng hàng không'], ['3350', 'Hãng hàng không'],
    ['3351', 'Hãng thuê xe'], ['3501', 'Chuỗi khách sạn'], ['4111', 'Vận tải, du lịch'],
    ['4900', 'Viễn thông, tiện ích'], ['5411', 'Bán lẻ, ô tô, xăng dầu'], ['5812', 'Ăn uống, nội dung số'],
    ['6540', 'Tài chính, bảo hiểm'], ['7011', 'Lưu trú, dịch vụ cá nhân'], ['8062', 'Y tế'],
    ['9311', 'Nhà nước'],
  ])('%s -> %s', (code, group) => {
    expect(getMccGroup(code)).toBe(group)
  })
})
