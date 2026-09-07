// Parser cho từng ngân hàng. Mỗi hàm nhận text thô, trả ParsedTransaction hoặc null.
//
// THÊM PARSER MỚI: xem hướng dẫn ở cuối file.

import type { ParsedTransaction, Parser } from './types.ts'
import { inferYear, last4, parseVND, vnDate } from './helpers.ts'

/**
 * Gom các field lặp lại ở mọi parser (currency, raw_text) về một chỗ.
 * Parser chỉ cần khai phần KHÁC NHAU giữa các bank.
 */
type ParserResult = Omit<ParsedTransaction, 'currency' | 'raw_text'>
const build = (text: string, r: ParserResult): ParsedTransaction =>
  ({ ...r, currency: 'VND', raw_text: text })

// ---------------------------------------------------------------------------
// LPBank — app notification (định dạng THẬT, xác nhận 07/09/2026)
// "07/09/2026|15:08|Tài khoản:0349360265|Số tiền GD:2,000|Số dư:2,001  VND|
//  Nội dung:249375-NGUYEN DUC HUY Chuyen tien|DT: *8668"
// ---------------------------------------------------------------------------
const tryLPBankApp: Parser = (text) => {
  const m = text.match(
    /(\d{2})\/(\d{2})\/(\d{4})\|(\d{2}):(\d{2})\|Tài khoản:(\d+)\|Số tiền GD:([-+]?[\d,.]+)\|Số dư:[\d,.]+\s*VND\|Nội dung:(.+?)\|DT:/,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, acct, amountStr, desc] = m

  // Định dạng này KHÔNG luôn có dấu +/-. Không có dấu => không suy được
  // vào/ra, nên mặc định coi là tiền VÀO (dương) và giữ nguyên raw_text để
  // đối chiếu. Cần mẫu giao dịch TRỪ TIỀN thật để chốt quy tắc.
  return build(text, {
    bank_name: 'LPBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: desc.trim(),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

// LPBank — SMS cũ (dự phòng khi nhận qua SMS thay vì app)
// "TK 03xxx265 -430VND 01092026 19:35 SD:44VND ND: Thu phi QLTK thang 082026"
const tryLPBankSMS: Parser = (text) => {
  const m = text.match(
    /TK\s*(\S+)\s*([-+][\d,.]+)VND\s*(\d{2})(\d{2})(\d{4})\s*(\d{2}):(\d{2})\s*SD:[\d,.]+VND\s*ND:\s*(.+)/,
  )
  if (!m) return null
  const [, acct, amountStr, dd, mm, yyyy, hh, min, desc] = m
  return build(text, {
    bank_name: 'LPBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: desc.trim(),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null, // ND của LPBank là mô tả nghiệp vụ, không phải merchant
  })
}

// SHB — "THE MASTERCARD CASHBACK 3826 SU DUNG -2,007,000 VND TAI HKD DAI DUONG
//        NGAY 03/09/26 19:35."
const trySHB: Parser = (text) => {
  // Dùng [^\n]{0,40}? thay vì .*? — KHÔNG phải style, là sửa ReDoS:
  // `.*?` không neo khiến engine thử lại ở MỌI vị trí bắt đầu rồi đi hết phần
  // đuôi tìm "NGAY" (không bao giờ tới) -> O(N²). Đo thật: payload 203KB mất
  // 8.669ms; sau khi giới hạn độ dài còn 0ms. Tên thẻ thật < 40 ký tự,
  // merchant < 60, nên giới hạn không làm mất giao dịch hợp lệ (đã so khớp
  // output trên notification thật: y hệt bản cũ).
  const m = text.match(
    /THE\s+[^\n]{0,40}?(\d{4})\s+SU DUNG\s*([-+][\d,.]+)\s*VND\s*TAI\s*([^\n]{1,60}?)\s*NGAY\s*(\d{2})\/(\d{2})\/(\d{2})\s*(\d{2}):(\d{2})/,
  )
  if (!m) return null
  const [, card, amountStr, merchant, dd, mm, yy, hh, min] = m
  return build(text, {
    bank_name: 'SHB',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// HDBank — "The 5858 thuc hien GD: 10,005,000 VND tai MEGAPAY*..., MGD: 651219,
//           ngay 22/08/2026 10:49:27."
const tryHDBank: Parser = (text) => {
  const m = text.match(
    /The\s*(\d{4})\s*thuc hien GD:\s*([\d,.]+)\s*VND\s*tai\s*(.+?),\s*MGD.*?ngay\s*(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):(\d{2})/,
  )
  if (!m) return null
  const [, card, amountStr, merchant, dd, mm, yyyy, hh, min, ss] = m
  return build(text, {
    bank_name: 'HDBank',
    amount: -parseVND(amountStr), // định dạng này luôn là chi tiêu
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// MSB — "The TD MSB 7230 thuc hien GD 3,520,000 VND luc 14:13 07/08/2026 tai MNAUMY."
const tryMSB: Parser = (text) => {
  const m = text.match(
    /MSB\s*(\d{4})\s*thuc hien GD\s*([\d,.]+)\s*VND\s*luc\s*(\d{2}):(\d{2})\s*(\d{2})\/(\d{2})\/(\d{4})\s*tai\s*(.+?)\./,
  )
  if (!m) return null
  const [, card, amountStr, hh, min, dd, mm, yyyy, merchant] = m
  return build(text, {
    bank_name: 'MSB',
    amount: -parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// VPBank — "The VPBank 5239...9808 vua chi tieu -5,061,000VND ND:MEGAPAY*...
//           vao luc 13:17 24/08."  (SMS KHÔNG có năm -> suy bằng inferYear)
const tryVPBank: Parser = (text) => {
  if (!text.includes('VPBank')) return null
  const m = text.match(
    /VPBank\s*(\S+)\s*(?:vua chi tieu|tang)\s*([-+][\d,.]+)VND\s*ND:(.+?)\s*vao luc\s*(\d{2}):(\d{2})\s*(\d{2})\/(\d{2})/,
  )
  if (!m) return null
  const [, cardStr, amountStr, merchant, hh, min, dd, mm] = m
  return build(text, {
    bank_name: 'VPBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(inferYear(mm, dd, hh, min), mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: last4(cardStr),
    merchant_name: merchant.trim(),
  })
}

// WOORIVN — "Giao dich thanh cong So the 4074***2789 16-08-26/10:03/3,006,000 VND
//            /NL-ALEPAY*KMPHONG1, VN,..."
const tryWOORIVN: Parser = (text) => {
  const m = text.match(
    /So the\s*(\S+)\s*(\d{2})-(\d{2})-(\d{2})\/(\d{2}):(\d{2})\/([\d,.]+)\s*VND\s*\/(.+?),/,
  )
  if (!m) return null
  const [, cardStr, dd, mm, yy, hh, min, amountStr, merchant] = m
  return build(text, {
    bank_name: 'WOORIVN',
    amount: -parseVND(amountStr),
    transaction_date: vnDate(yy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: last4(cardStr),
    merchant_name: merchant.trim(),
  })
}

// UOB — "Nhan tien vao Tai khoan/Credited to Account: *0568.
//        So tien/Amount: VND 4,827,000. Ngay/Date: 18/07/26 18:10."
const tryUOB: Parser = (text) => {
  const m = text.match(
    /Account:\s*\*?(\d{4})\.\s*So tien\/Amount:\s*VND\s*([\d,.]+)\.\s*Ngay\/Date:\s*(\d{2})\/(\d{2})\/(\d{2})\s*(\d{2}):(\d{2})/,
  )
  if (!m) return null
  const [, acct, amountStr, dd, mm, yy, hh, min] = m
  return build(text, {
    bank_name: 'UOB',
    amount: parseVND(amountStr), // nhận tiền -> dương
    transaction_date: vnDate(yy, mm, dd, hh, min),
    description: 'Nhan tien vao tai khoan',
    source_type: 'bank',
    account_ref: acct,
    merchant_name: null,
  })
}

// Sacombank — "Ngày 01/09/2026 16:25 thẻ Visa UNIQ Pla Credit 4682
//              giao dịch 500,000 VND tại AEON..."
const trySacombank: Parser = (text) => {
  const m = text.match(
    /Ngày\s*(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}).*?(\d{4})\s*giao dịch\s*([\d,.]+)\s*VND\s*tại\s*(.+)/s,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, card, amountStr, merchant] = m
  return build(text, {
    bank_name: 'Sacombank',
    amount: -parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// MoMo — "Bạn đã thực hiện thanh toán thành công cho KAI COFFEE với số tiền 39.000đ."
// Không có mốc giờ trong text -> dùng giờ nhận.
const tryMoMo: Parser = (text) => {
  const m = text.match(/thanh toán thành công cho\s*(.+?)\s*với số tiền\s*([\d.]+)đ/)
  if (!m) return null
  const [, merchant, amountStr] = m
  return build(text, {
    bank_name: 'MoMo',
    amount: -parseVND(amountStr),
    transaction_date: new Date().toISOString(),
    description: merchant.trim(),
    source_type: 'bank', // ví điện tử, coi như tài khoản
    account_ref: null, // MoMo không có số thẻ/TK trong text
    merchant_name: merchant.trim(),
  })
}

// BIDV — "Thời gian giao dịch: 07:27 07/09/2026 ... Số tiền GD: -50,000 VND ...
//         Nội dung giao dịch: ..."
const tryBIDV: Parser = (text) => {
  const m = text.match(
    /Thời gian giao dịch:\s*(\d{2}):(\d{2})\s*(\d{2})\/(\d{2})\/(\d{4}).*?Số tiền GD:\s*([-+][\d,.]+)\s*VND.*?Nội dung giao dịch:\s*(.+?)(?:Mã giao dịch|$)/s,
  )
  if (!m) return null
  const [, hh, min, dd, mm, yyyy, amountStr, desc] = m
  const acct = text.match(/[Tt]ài khoản:?\s*\S*?(\d{4})/)
  return build(text, {
    bank_name: 'BIDV',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: desc.trim(),
    source_type: 'bank',
    account_ref: acct ? acct[1] : null,
    merchant_name: null,
  })
}

/**
 * Thứ tự QUAN TRỌNG: parser chạy lần lượt, cái nào khớp trước thì thắng.
 * Đặt định dạng CỤ THỂ hơn lên trước định dạng tổng quát
 * (vd LPBankApp trước LPBankSMS).
 */
export const parsers: Parser[] = [
  tryLPBankApp,
  tryLPBankSMS,
  trySHB,
  tryHDBank,
  tryMSB,
  tryVPBank,
  tryWOORIVN,
  tryUOB,
  trySacombank,
  tryMoMo,
  tryBIDV,
]

// ---------------------------------------------------------------------------
// CÁCH THÊM PARSER CHO BANK MỚI
//
// CHƯA CÓ parser: OCB, Eximbank, VIB, ACB, HSBC, KBank, Cake, Vietinbank,
//                 BaoVietBank, ShinhanBank  (17/41 thẻ)
//
// KHÔNG viết regex theo phỏng đoán — sai định dạng thì hoặc không khớp, hoặc
// tệ hơn là bóc sai SỐ TIỀN mà không ai biết. Quy trình đúng:
//
//   1. Thực hiện 1 giao dịch nhỏ bằng thẻ đó
//   2. Copy NGUYÊN VĂN notification/SMS nhận được
//   3. Query bảng `unparsed_messages` để lấy raw_text (edge function tự lưu
//      mọi tin không khớp parser nào)
//   4. Thêm 1 case vào parsers.test.ts với text thật đó
//   5. Viết parser cho tới khi test xanh
//
// Lưu ý OCB: từ 31/03/2025 OCB ĐÃ NGỪNG gửi SMS cho giao dịch thẻ tín dụng,
// chuyển sang push notification trong app OCB OMNI. Phải bắt qua Shortcut đọc
// notification, không phải SMS.
// ---------------------------------------------------------------------------
