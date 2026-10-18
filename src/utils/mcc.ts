/**
 * MCC (Merchant Category Code) do người dùng tự gán cho giao dịch thẻ.
 *
 * SMS/push của ngân hàng VN hầu như không kèm MCC nên không thể tự điền. Danh sách rút
 * gọn dưới đây là những nhóm hay xuất hiện trong rule hoàn tiền của thẻ; mỗi mục là một
 * mã 4 chữ số thật (ISO 18245). Rule hoàn tiền (phase sau) tham chiếu CÙNG danh sách này.
 *
 * MCC độc lập với `Category` (Ăn uống, Mua sắm…) ở v1: Category phục vụ thống kê chi
 * tiêu, MCC phục vụ tính hoàn tiền theo cách ngân hàng phân loại.
 */
export interface MccOption {
  code: string
  label: string
  /**
   * Từ khoá trong tên merchant để gợi ý MCC: không dấu, chữ thường, KHÔNG thừa khoảng trắng
   * ở hai đầu (mọi từ khoá đều khớp theo ranh giới từ). Dấu `& . !` được giữ trong từ khoá;
   * `-` và khoảng trắng đều thành khoảng trắng nên viết "co op" chứ không viết "co-op".
   */
  keywords: string[]
}

export const MCC_OPTIONS: readonly MccOption[] = [
  { code: '5411', label: 'Siêu thị', keywords: ['winmart', 'bach hoa xanh', 'coopmart', 'coop food', 'co.op', 'co op', 'big c', 'go!', 'lotte mart', 'aeon', 'mega market', 'emart', 'satra', 'tops market', 'bhx'] },
  { code: '5812', label: 'Nhà hàng', keywords: ['restaurant', 'nha hang', 'quan an', 'pizza', 'buffet', 'sushi', 'lau', 'bbq', 'pho'] },
  { code: '5814', label: 'Đồ ăn nhanh / cafe', keywords: ['highlands', 'highland', 'the coffee house', 'phuc long', 'starbucks', 'cong ca phe', 'trung nguyen', 'kfc', 'lotteria', 'jollibee', 'mcdonald', 'burger king', 'circle k', 'cafe', 'coffee', 'ca phe', 'tra sua', 'gongcha', 'grabfood', 'shopeefood', 'baemin'] },
  { code: '5541', label: 'Xăng dầu', keywords: ['petrolimex', 'pvoil', 'pv oil', 'xang dau', 'cay xang', 'shell', 'caltex', 'comeco'] },
  { code: '4121', label: 'Taxi / xe công nghệ', keywords: ['grab', 'gojek', 'xanh sm', 'be', 'be group', 'mai linh', 'vinasun', 'taxi'] },
  { code: '4111', label: 'Giao thông công cộng', keywords: ['xe buyt', 'bus', 'vetc', 'epass', 'phi cau duong'] },
  { code: '5311', label: 'Bách hóa / Trung tâm thương mại', keywords: ['shopee', 'lazada', 'tiki', 'sendo', 'tiktok shop'] },
  { code: '5651', label: 'Quần áo', keywords: ['uniqlo', 'zara', 'h&m', 'canifa', 'owen', 'routine', 'yame', 'coolmate', 'thoi trang', 'fashion'] },
  { code: '5732', label: 'Điện tử', keywords: ['the gioi di dong', 'thegioididong', 'dien may xanh', 'fpt shop', 'cellphones', 'cps', 'nguyen kim', 'pico', 'apple', 'samsung', 'hoang ha mobile'] },
  { code: '5942', label: 'Sách / Văn phòng phẩm', keywords: ['fahasa', 'nha sach', 'phuong nam', 'thien long', 'hong ha', 'sach'] },
  { code: '5912', label: 'Nhà thuốc', keywords: ['pharmacity', 'long chau', 'an khang', 'nha thuoc', 'guardian', 'medicare'] },
  { code: '8011', label: 'Y tế', keywords: ['benh vien', 'phong kham', 'hospital', 'clinic', 'vinmec', 'y te', 'nha khoa', 'medlatec'] },
  { code: '4899', label: 'Giải trí / Streaming', keywords: ['netflix', 'spotify', 'youtube', 'disney', 'apple music', 'icloud', 'google one', 'fpt play', 'vieon', 'tv360', 'steam', 'playstation', 'app store', 'google play'] },
  { code: '7832', label: 'Rạp phim', keywords: ['cgv', 'lotte cinema', 'galaxy cinema', 'bhd', 'beta cinemas', 'rap phim', 'cinema'] },
  { code: '4900', label: 'Điện nước', keywords: ['evn', 'dien luc', 'cap nuoc', 'sawaco', 'tien dien', 'tien nuoc'] },
  { code: '4814', label: 'Viễn thông', keywords: ['viettel', 'vinaphone', 'mobifone', 'vietnamobile', 'fpt telecom', 'vnpt', 'nap tien dien thoai', 'internet'] },
]

const LABEL_BY_CODE = new Map(MCC_OPTIONS.map((o) => [o.code, o.label]))

/** Nhãn của một mã MCC; undefined nếu mã không nằm trong danh sách rút gọn. */
export function getMccLabel(code: string | undefined | null): string | undefined {
  return code ? LABEL_BY_CODE.get(code) : undefined
}

/** "5411 · Siêu thị"; mã lạ chỉ hiện mã. */
export function formatMcc(code: string): string {
  const label = getMccLabel(code)
  return label ? `${code} · ${label}` : code
}

/**
 * Đưa tên merchant về dạng so khớp: bỏ dấu tiếng Việt, chữ thường, chỉ giữ `a-z 0-9 & . !`
 * (phần còn lại thành khoảng trắng), và dính `&` vào hai bên để "H & M" khớp từ khoá "h&m".
 */
function normalizeMerchant(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9&.!]+/g, ' ')
    .replace(/\s*&\s*/g, '&')
    .trim()
}

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g

/**
 * Mỗi từ khoá thành một regex ranh giới từ, dựng một lần lúc nạp module. Ranh giới trước là
 * `(?:^|[^a-z0-9])` thay vì lookbehind `(?<!…)`: lookbehind làm Safari < 16.4 ném SyntaxError
 * ngay khi nạp module và kéo sập cả app, chỉ vì một tính năng gợi ý phụ.
 */
const MATCHERS = MCC_OPTIONS.flatMap((o) =>
  o.keywords.map((kw) => ({
    code: o.code,
    length: kw.length,
    re: new RegExp(`(?:^|[^a-z0-9])${kw.replace(ESCAPE_REGEX, '\\$&')}(?![a-z0-9])`),
  }))
)

/**
 * Gợi ý MCC từ tên merchant. KHÔNG bao giờ tự ghi vào DB: chỉ là đề xuất để user bấm xác nhận,
 * vì khớp từ khoá có thể sai (vd "Grab" có thể là GrabFood chứ không phải taxi).
 *
 * - Mọi từ khoá khớp theo RANH GIỚI TỪ: "shell" không khớp "Shellfish", "big c" không khớp
 *   "Big Cinema", "y te" không khớp "Sky Tea". Chuỗi con giữa từ đã từng gợi ý sai.
 * - Nhiều từ khoá cùng khớp thì lấy TỪ KHOÁ DÀI NHẤT (cụ thể nhất): "apple music" (4899) thắng
 *   "apple" (5732), "nap tien dien thoai" (4814) thắng "tien dien" (4900). Hoà thì lấy mục đứng
 *   trước trong MCC_OPTIONS. Không dựa vào thứ tự danh sách để chọn.
 * - Từ khoá chỉ ĐỊA ĐIỂM (Vincom, mall…) hoặc nhập nhằng (metro = tàu điện hay siêu thị sỉ,
 *   gas = khí đốt hay trạm xăng) cố ý không có trong danh sách.
 */
export function suggestMcc(merchantName: string | undefined | null): string | null {
  if (!merchantName) return null
  const text = normalizeMerchant(merchantName)
  let best: { code: string; length: number } | null = null
  for (const m of MATCHERS) {
    if (m.re.test(text) && (best === null || m.length > best.length)) best = m
  }
  return best?.code ?? null
}
