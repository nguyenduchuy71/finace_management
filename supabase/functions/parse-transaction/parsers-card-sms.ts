// Parser SMS/push GIAO DỊCH THẺ: SHB, HDBank, MSB, VPBank, WOORIVN.
// Tách khỏi parsers.ts (giữ file < 200 dòng). Thứ tự trong cardSmsParsers = thứ tự cũ trong
// mảng `parsers` — parser khớp trước thắng, đừng sắp xếp lại.

import type { Parser } from './types.ts'
import { inferYear, last4, outflow, parseVND, vnDate } from './helpers.ts'
import { build } from './parser-build.ts'

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
    amount: outflow(amountStr), // định dạng này luôn là chi tiêu
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
    amount: outflow(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// VPBank — "The VPBank 5239...9808 vua chi tieu -5,061,000VND ND:MEGAPAY*...
//           vao luc 13:17 24/08."  (SMS KHÔNG có năm -> suy bằng inferYear)
const tryVPBank: Parser = (text, now) => {
  if (!text.includes('VPBank')) return null
  const m = text.match(
    /VPBank\s*(\S+)\s*(?:vua chi tieu|tang)\s*([-+][\d,.]+)VND\s*ND:(.+?)\s*vao luc\s*(\d{2}):(\d{2})\s*(\d{2})\/(\d{2})/,
  )
  if (!m) return null
  const [, cardStr, amountStr, merchant, hh, min, dd, mm] = m
  return build(text, {
    bank_name: 'VPBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(inferYear(mm, dd, hh, min, now), mm, dd, hh, min),
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
    amount: outflow(amountStr),
    transaction_date: vnDate(yy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: last4(cardStr),
    merchant_name: merchant.trim(),
  })
}

export const cardSmsParsers: Parser[] = [
  trySHB,
  tryHDBank,
  tryMSB,
  tryVPBank,
  tryWOORIVN,
]
