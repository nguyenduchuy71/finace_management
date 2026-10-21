// Parser cho từng ngân hàng. Mỗi hàm nhận text thô, trả ParsedTransaction hoặc null.
//
// THÊM PARSER MỚI: xem hướng dẫn ở cuối file.

import type { Parser } from './types.ts'
import { last4, nowVN, parseVND, vnDate } from './helpers.ts'
import { build } from './parser-build.ts'
import { balanceNotificationParsers } from './parsers-balance-notifications.ts'
import { cardSmsParsers } from './parsers-card-sms.ts'

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
const tryMoMo: Parser = (text, now) => {
  const m = text.match(/thanh toán thành công cho\s*(.+?)\s*với số tiền\s*([\d.]+)đ/)
  if (!m) return null
  const [, merchant, amountStr] = m
  return build(text, {
    bank_name: 'MoMo',
    amount: -parseVND(amountStr),
    transaction_date: nowVN(now),
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
  ...cardSmsParsers, // SHB, HDBank, MSB, VPBank, WOORIVN
  tryUOB,
  trySacombank,
  tryMoMo,
  tryBIDV,
  // Push "biến động số dư" (BIDV/OCB/HDBank TK, Vietinbank, SHB SAHA, Cake, Sacombank Pay)
  ...balanceNotificationParsers,
]

// ---------------------------------------------------------------------------
// CÁCH THÊM PARSER CHO BANK MỚI
//
// CHƯA CÓ parser: Eximbank, VIB, ACB, HSBC, KBank, BaoVietBank, ShinhanBank.
// OCB/Cake/Vietinbank/Sacombank Pay/SHB SAHA/BIDV push: parsers-balance-notifications.ts
// SHB/HDBank/MSB/VPBank/WOORIVN (giao dịch thẻ): parsers-card-sms.ts. Parser mới đặt vào file theo nhóm,
// và chèn vào mảng `parsers` ĐÚNG vị trí (cụ thể trước tổng quát).
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
// chuyển sang push notification trong app OCB OMNI. Phải bắt bằng trigger
// Notification của Shortcuts (iOS 27+), không phải SMS. Xem docs/ios-shortcut-setup.md
// ---------------------------------------------------------------------------
