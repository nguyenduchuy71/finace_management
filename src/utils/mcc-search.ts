import { COMMON_MCC_OPTIONS, MCC_OPTIONS, normalizeMerchant, type MccOption } from './mcc'

/**
 * Nhóm MCC theo dải mã (cách Visa/Mastercard chia nhóm). Mảng sắp theo `from` tăng dần; mã thuộc nhóm
 * có `from` lớn nhất mà ≤ mã.
 */
const MCC_GROUPS: readonly { from: number; label: string }[] = [
  { from: 0, label: 'Nông nghiệp' },
  { from: 1500, label: 'Nhà thầu, xây dựng' },
  { from: 2700, label: 'In ấn, hoá chất' },
  { from: 3000, label: 'Hãng hàng không' },
  { from: 3351, label: 'Hãng thuê xe' },
  { from: 3501, label: 'Chuỗi khách sạn' },
  { from: 4000, label: 'Vận tải, du lịch' },
  { from: 4800, label: 'Viễn thông, tiện ích' },
  { from: 5000, label: 'Bán buôn' },
  { from: 5200, label: 'Bán lẻ, ô tô, xăng dầu' },
  { from: 5600, label: 'Quần áo, giày dép' },
  { from: 5700, label: 'Nội thất, điện tử' },
  { from: 5800, label: 'Ăn uống, nội dung số' },
  { from: 5900, label: 'Cửa hàng chuyên doanh' },
  { from: 6000, label: 'Tài chính, bảo hiểm' },
  { from: 7000, label: 'Lưu trú, dịch vụ cá nhân' },
  { from: 7300, label: 'Dịch vụ doanh nghiệp' },
  { from: 7500, label: 'Ô tô, sửa chữa' },
  { from: 7800, label: 'Giải trí' },
  { from: 8000, label: 'Y tế' },
  { from: 8100, label: 'Giáo dục, chuyên môn, tổ chức' },
  { from: 9000, label: 'Nhà nước' },
]

/** Tên nhóm của một mã 4 chữ số ("5411" -> "Bán lẻ, ô tô, xăng dầu"). */
export function getMccGroup(code: string): string {
  const n = Number(code)
  let label = MCC_GROUPS[0].label
  for (const g of MCC_GROUPS) {
    if (g.from > n) break
    label = g.label
  }
  return label
}

/** Mã riêng của từng hãng bay / hãng thuê xe / chuỗi khách sạn. */
const isBrandCode = (code: string) => code >= '3000' && code <= '3999'

const SEARCH_INDEX = MCC_OPTIONS.map((o) => ({
  option: o,
  text: normalizeMerchant(`${o.label} ${o.keywords.join(' ')}`),
}))

/**
 * Tìm MCC theo mã hoặc chữ (không dấu, không phân biệt hoa thường; khớp cả từ khoá gợi ý: gõ
 * "grab" ra 4121). Thứ tự: trùng mã > mã bắt đầu bằng chuỗi gõ > chữ khớp ở mã nhóm chung > chữ khớp
 * ở mã riêng của hãng (3000–3999). Không đẩy mã hãng xuống thì gõ "khach san" ra 400 chuỗi khách sạn
 * trước, còn 7011 rơi khỏi danh sách.
 * Ô tìm trống = các mã hay gặp. Cắt ở `limit` để popover không dựng cả nghìn dòng.
 */
export function searchMcc(query: string, limit = 50): MccOption[] {
  const q = normalizeMerchant(query)
  if (!q) return COMMON_MCC_OPTIONS.slice(0, limit)

  const exact: MccOption[] = []
  const prefix: MccOption[] = []
  const text: MccOption[] = []
  const brand: MccOption[] = []
  for (const { option, text: haystack } of SEARCH_INDEX) {
    if (option.code === q) exact.push(option)
    else if (/^\d+$/.test(q) && option.code.startsWith(q)) prefix.push(option)
    else if (haystack.includes(q)) (isBrandCode(option.code) ? brand : text).push(option)
  }
  return [...exact, ...prefix, ...text, ...brand].slice(0, limit)
}
