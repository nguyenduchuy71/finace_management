import { describe, it, expect } from 'vitest'
import { COMMON_MCC_OPTIONS, MCC_OPTIONS, formatMcc, getMccLabel, suggestMcc } from './mcc'
import { MCC_KEYWORDS } from './mcc-keywords'

describe('MCC_OPTIONS', () => {
  it('danh sách đầy đủ: ~1000 mã 4 chữ số, không trùng, sắp theo mã', () => {
    expect(MCC_OPTIONS.length).toBeGreaterThan(990)
    const codes = MCC_OPTIONS.map((o) => o.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of codes) expect(c).toMatch(/^\d{4}$/)
    expect(codes).toEqual([...codes].sort())
  })

  it('mã mới hơn bộ dữ liệu gốc đã được bổ sung', () => {
    for (const c of ['5262', '5552', '6050', '6536', '6537', '6538', '6540', '7280', '7322', '9406']) {
      expect(getMccLabel(c), c).toBeTruthy()
    }
  })

  it('16 mã ban đầu giữ nguyên nhãn (rule và giao dịch cũ hiển thị như trước)', () => {
    expect(Object.fromEntries(['5411', '5812', '5814', '5541', '4121', '4111', '5311', '5651',
      '5732', '5942', '5912', '8011', '4899', '7832', '4900', '4814'].map((c) => [c, getMccLabel(c)]))).toEqual({
      '5411': 'Siêu thị', '5812': 'Nhà hàng', '5814': 'Đồ ăn nhanh / cafe', '5541': 'Xăng dầu',
      '4121': 'Taxi / xe công nghệ', '4111': 'Giao thông công cộng', '5311': 'Bách hóa / Trung tâm thương mại',
      '5651': 'Quần áo', '5732': 'Điện tử', '5942': 'Sách / Văn phòng phẩm', '5912': 'Nhà thuốc',
      '8011': 'Y tế', '4899': 'Giải trí / Streaming', '7832': 'Rạp phim', '4900': 'Điện nước', '4814': 'Viễn thông',
    })
  })

  it('mọi mục có nhãn; mọi mã có từ khoá đều nằm trong danh sách', () => {
    for (const o of MCC_OPTIONS) expect(o.label.length, o.code).toBeGreaterThan(0)
    for (const code of Object.keys(MCC_KEYWORDS)) expect(getMccLabel(code), code).toBeDefined()
    expect(COMMON_MCC_OPTIONS.length).toBe(Object.keys(MCC_KEYWORDS).length)
  })

  it('từ khoá: không dấu, chữ thường, không thừa khoảng trắng, không trùng giữa các mã', () => {
    const seen = new Map<string, string>()
    for (const o of COMMON_MCC_OPTIONS) {
      for (const k of o.keywords) {
        expect(k).toMatch(/^[a-z0-9&.!]+( [a-z0-9&.!]+)*$/)
        expect(seen.get(k), `"${k}" trùng ở ${seen.get(k)} và ${o.code}`).toBeUndefined()
        seen.set(k, o.code)
      }
    }
  })
})

describe('getMccLabel / formatMcc', () => {
  it('trả nhãn cho mã đã biết', () => {
    expect(getMccLabel('5411')).toBe('Siêu thị')
    expect(formatMcc('5411')).toBe('5411 · Siêu thị')
  })

  it('mã lạ hoặc rỗng: không ném lỗi', () => {
    expect(getMccLabel('1234')).toBeUndefined()
    expect(getMccLabel(null)).toBeUndefined()
    expect(getMccLabel(undefined)).toBeUndefined()
    expect(formatMcc('1234')).toBe('1234')
  })
})

describe('suggestMcc', () => {
  it.each([
    ['WINMART HCM', '5411'],
    ['Bách Hóa Xanh 123', '5411'],
    ['HIGHLANDS COFFEE', '5814'],
    ['CIRCLE K', '5814'],
    ['PETROLIMEX CH 12', '5541'],
    ['GRAB* A-7K2', '4121'],
    ['Xanh SM', '4121'],
    ['SHOPEE', '5311'],
    ['NETFLIX.COM', '4899'],
    ['CGV VINCOM', '7832'],
    ['PHARMACITY', '5912'],
    ['VIETTEL TOP UP', '4814'],
    ['EVN HCMC', '4900'],
  ])('%s -> %s', (merchant, want) => {
    expect(suggestMcc(merchant)).toBe(want)
  })

  it('không phân biệt hoa thường và dấu', () => {
    expect(suggestMcc('bach hoa xanh')).toBe('5411')
    expect(suggestMcc('BÁCH HÓA XANH')).toBe('5411')
  })

  // `includes('be')` của classifyTransaction dính vào mọi tên chứa "be" — ở đây phải khớp nguyên từ.
  it.each(['Bell Tower Shop', 'Best Shop', 'Cabernet Store', 'Abe Mart Co'])(
    'từ khoá ngắn không khớp giữa từ: %s', (merchant) => {
      expect(suggestMcc(merchant)).not.toBe('4121')
    }
  )

  // Các từ khoá ≤ 3 ký tự THẬT trong danh sách (bhd, evn, cps, kfc): chuỗi con giữa từ không được khớp.
  it.each([
    ['ABHDX Shop', '7832'],
    ['Nevna Boutique', '4900'],
    ['Pcpsx Trading', '5732'],
    ['Skfcx Foods', '5814'],
  ])('từ khoá ngắn không khớp chuỗi con giữa từ: %s không phải %s', (merchant, wrong) => {
    expect(suggestMcc(merchant)).not.toBe(wrong)
  })

  it.each([['BHD STAR', '7832'], ['EVN HCMC', '4900'], ['KFC 123', '5814']])(
    'cùng từ khoá ngắn đó khớp khi đứng thành từ riêng: %s -> %s', (merchant, want) => {
      expect(suggestMcc(merchant)).toBe(want)
    }
  )

  it('từ khoá ngắn khớp khi đứng thành từ riêng', () => {
    expect(suggestMcc('BE GROUP')).toBe('4121')
    expect(suggestMcc('Thanh toan BE')).toBe('4121')
  })

  it('không khớp / rỗng thì null', () => {
    expect(suggestMcc('CONG TY TNHH XYZ')).toBeNull()
    expect(suggestMcc('')).toBeNull()
    expect(suggestMcc(undefined)).toBeNull()
    expect(suggestMcc(null)).toBeNull()
  })

  // Kiểm tra TỰ NHẤT QUÁN: mỗi từ khoá phải trả về đúng mục chứa nó. Bắt được từ khoá bị
  // từ khoá khác (của mục khác) che mất — "apple" che "apple music", "tien dien" che
  // "nap tien dien thoai". Test cũ chỉ kiểm mã trả về nằm trong danh sách, đúng theo cấu trúc.
  it('mỗi từ khoá gợi ý đúng mục chứa nó', () => {
    for (const o of COMMON_MCC_OPTIONS) {
      for (const k of o.keywords) {
        expect(suggestMcc(k), `từ khoá "${k}"`).toBe(o.code)
      }
    }
  })

  // Từng ca sai đã được reviewer chứng minh bằng chạy thử trước khi chuyển sang khớp theo ranh giới từ.
  it.each([
    ['Sky Tea', '8011'], ['BIG CINEMA', '5411'], ['SHELLFISH', '5541'], ['Seashell Spa', '5541'],
    ['Bột mì Hoàng Gia', '4111'], ['Metro Cash & Carry', '4111'], ['Phone Shop', '5812'],
    ['Cabus Trading', '4111'], ['Fashionista', '5651'],
  ])('chuỗi con giữa từ không khớp: %s không phải %s', (merchant, wrong) => {
    expect(suggestMcc(merchant)).not.toBe(wrong)
  })

  it('từ khoá nhập nhằng đã bị loại: "gas", "metro" không gợi ý bừa', () => {
    expect(suggestMcc('GAS STATION ABC')).toBeNull()
    expect(suggestMcc('Metro')).toBeNull()
  })

  it('từ khoá dài hơn (cụ thể hơn) thắng từ khoá ngắn của mục khác', () => {
    expect(suggestMcc('Apple Music')).toBe('4899')
    expect(suggestMcc('APPLE.COM/BILL Apple Music')).toBe('4899')
    expect(suggestMcc('Apple Store')).toBe('5732')
    expect(suggestMcc('Nạp tiền điện thoại')).toBe('4814')
    expect(suggestMcc('Thanh toán tiền điện')).toBe('4900')
  })

  it('dấu & . - và khoảng trắng không làm mất từ khoá', () => {
    expect(suggestMcc('H & M')).toBe('5651')
    expect(suggestMcc('H&M VIETNAM')).toBe('5651')
    expect(suggestMcc('Co-op Food')).toBe('5411')
    expect(suggestMcc('CO.OP MART')).toBe('5411')
    expect(suggestMcc('GO! Dĩ An')).toBe('5411')
    expect(suggestMcc('NETFLIX.COM')).toBe('4899')
  })
})
