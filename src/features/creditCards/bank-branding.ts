// Nhận diện thương hiệu ngân hàng: viết tắt + màu, dựng hoàn toàn bằng CSS.
//
// KHÔNG dùng ảnh logo thật, vì 2 lý do độc lập — mỗi lý do đủ để loại:
//
//  1. CSP của app là `img-src 'self' data:` (xem vercel.json). Mọi URL ảnh
//     ngoại vi bị CHẶN, không hiện gì và cũng không báo lỗi rõ ràng.
//  2. Logo ngân hàng là nhãn hiệu đã đăng ký. Nhúng file logo vào repo/bundle
//     là phát hành lại tài sản thương hiệu — chỉ để tránh rắc rối pháp lý.
//
// Monogram + màu thương hiệu cho nhận diện thị giác gần bằng logo thật với
// chi phí bằng 0: không request mạng, không phụ thuộc CDN, hoạt động offline,
// không rò referrer sang bên thứ ba, và luôn hiển thị được.
//
// `bank_name` phải khớp giá trị trong DB (bảng credit_cards). Xem danh sách:
//   select distinct bank_name from credit_cards;

export interface BankBrand {
  /** Viết tắt hiển thị trong ô vuông — tối đa 4 ký tự cho vừa. */
  short: string
  /** Tailwind classes: nền + chữ. Dùng cặp có tương phản đủ ở cả light/dark. */
  className: string
}

/**
 * Màu lấy theo tông thương hiệu quen thuộc của từng ngân hàng để dễ nhận ra,
 * nhưng dùng thang màu Tailwind thay vì mã hex chính xác của họ — tránh dùng
 * đúng màu nhãn hiệu, đồng thời đảm bảo tương phản ở dark mode.
 */
const BANKS: Record<string, BankBrand> = {
  ACB:         { short: 'ACB',  className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  BIDV:        { short: 'BIDV', className: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  BaoVietBank: { short: 'BV',   className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  Cake:        { short: 'Cake', className: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  Eximbank:    { short: 'EXIM', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  HDBank:      { short: 'HD',   className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  HSBC:        { short: 'HSBC', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  KBank:       { short: 'KB',   className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  LPBank:      { short: 'LP',   className: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300' },
  MSB:         { short: 'MSB',  className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  OCB:         { short: 'OCB',  className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  SHB:         { short: 'SHB',  className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  Sacombank:   { short: 'STB',  className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  ShinhanBank: { short: 'SHIN', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  UOB:         { short: 'UOB',  className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  VIB:         { short: 'VIB',  className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  VPBank:      { short: 'VP',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  Vietinbank:  { short: 'CTG',  className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  WOORIVN:     { short: 'WOO',  className: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
}

const FALLBACK_CLASS = 'bg-muted text-muted-foreground'

/**
 * Trả về monogram cho một ngân hàng. Ngân hàng chưa khai báo (thẻ mới thêm sau)
 * vẫn hiển thị được: lấy tối đa 4 ký tự đầu của tên, màu trung tính.
 * Không bao giờ ném lỗi hay trả undefined — UI luôn có thứ để render.
 */
export function getBankBrand(bankName: string): BankBrand {
  const known = BANKS[bankName]
  if (known) return known

  const short = bankName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
  return { short: short || '?', className: FALLBACK_CLASS }
}

/** Nhãn loại thẻ hiển thị cho người dùng. */
export const CARD_TYPE_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  jcb: 'JCB',
  amex: 'Amex',
}
