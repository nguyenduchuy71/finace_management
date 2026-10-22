import { MCC_CODES } from './mcc-codes'
import { MCC_KEYWORDS } from './mcc-keywords'

/**
 * MCC (Merchant Category Code) do người dùng tự gán cho giao dịch thẻ.
 *
 * SMS/push của ngân hàng VN hầu như không kèm MCC nên không thể tự điền. Danh sách là bộ mã ISO 18245
 * ĐẦY ĐỦ (~1000 mã, `mcc-codes.ts`) để khớp đúng mã ngân hàng ghi trong điều khoản hoàn tiền; một phần
 * nhỏ có từ khoá gợi ý (`mcc-keywords.ts`). Rule hoàn tiền tham chiếu CÙNG danh sách này.
 *
 * MCC độc lập với `Category` (Ăn uống, Mua sắm…): Category phục vụ thống kê chi tiêu, MCC phục vụ
 * tính hoàn tiền theo cách ngân hàng phân loại.
 */
export interface MccOption {
  code: string
  label: string
  /** Từ khoá gợi ý (xem quy ước ở mcc-keywords.ts); rỗng = chỉ chọn được bằng tìm kiếm. */
  keywords: readonly string[]
}

export const MCC_OPTIONS: readonly MccOption[] = MCC_CODES.map(([code, label]) => ({
  code, label, keywords: MCC_KEYWORDS[code] ?? [],
}))

/** Mã có từ khoá gợi ý = nhóm hay gặp ở VN; hiện sẵn khi ô tìm MCC còn trống. */
export const COMMON_MCC_OPTIONS: readonly MccOption[] = MCC_OPTIONS.filter((o) => o.keywords.length > 0)

const LABEL_BY_CODE = new Map(MCC_OPTIONS.map((o) => [o.code, o.label]))

/** Nhãn của một mã MCC; undefined nếu mã không nằm trong danh sách. */
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
export function normalizeMerchant(s: string): string {
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
const MATCHERS = COMMON_MCC_OPTIONS.flatMap((o) =>
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
 *   "apple" (5732), "nap tien dien thoai" (4814) thắng "tien dien" (4900). Hoà thì lấy MÃ NHỎ HƠN
 *   (MCC_OPTIONS sắp theo mã). Không dựa vào thứ tự danh sách để chọn.
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
