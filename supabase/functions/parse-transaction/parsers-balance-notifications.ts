// Parser cho thông báo "biến động số dư" dạng push app (iOS Notification trigger).
//
// Mẫu THẬT lấy từ `unparsed_messages` (21/10/2026). Ngân hàng xác định bằng đuôi
// thẻ/TK đối chiếu bảng credit_cards (vd "the 0702" = Vietinbank, "••9526" = Cake).
//
// Lưu ý chung:
// - Thông báo iOS có tiêu đề ở dòng đầu ("Thông báo BIDV") và các field ngăn cách
//   bằng "\n" HOẶC U+2008 (punctuation space) tuỳ app/phiên bản -> dùng `\s`
//   (JS `\s` gồm cả U+2008), không dùng dấu cách cứng.
// - Khoảng trống giữa hai field dùng `[\s\S]{0,N}?` có cận trên — không `.*?`
//   không neo (xem MAX_TEXT_LENGTH trong index.ts).
// - Tin không có ngày giờ -> `nowVN()`: push đến gần như tức thì sau giao dịch.

import type { Parser } from './types.ts'
import { inferYear, last4, nowVN, parseVND, vnDate } from './helpers.ts'
import { build } from './parser-build.ts'

const desc = (s: string) => s.trim()

// BIDV — push SmartBanking, KHÔNG có thời gian giao dịch (khác tryBIDV cũ):
// "Thông báo BIDV\nTài khoản thanh toán: 1440243946 Số tiền GD: -499,000 VND
//  Số dư cuối: 545,832 VND Nội dung giao dịch: MB-TKThe ..."
const tryBIDVAccount: Parser = (text) => {
  const m = text.match(
    /Tài khoản thanh toán:\s*(\d+)\s+Số tiền GD:\s*([-+][\d,.]+)\s*VND\s+Số dư cuối:[\s\S]{0,40}?Nội dung giao dịch:\s*([^\n]{1,300})/,
  )
  if (!m) return null
  const [, acct, amountStr, content] = m
  return build(text, {
    bank_name: 'BIDV',
    amount: parseVND(amountStr),
    transaction_date: nowVN(),
    description: desc(content),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

// Vietinbank — "Tin biến động số dư\nThời gian: 20/10/2026 17:32\nTài khoản: 104885084982
//  \nGiao dịch: -79,000 VND\nSố dư hiện tại: 70,758 VND\nNội dung: GD thanh toan tai Grab, the 0702"
// "(DAO)" ở đầu nội dung = đảo/hoàn giao dịch, giữ nguyên dấu + của text.
const tryVietinbank: Parser = (text) => {
  const m = text.match(
    /Thời gian:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+Tài khoản:\s*(\d+)\s+Giao dịch:\s*([-+][\d,.]+)\s*VND\s+Số dư hiện tại:[\s\S]{0,40}?Nội dung:\s*([^\n]{1,300})/,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, acct, amountStr, content] = m
  return build(text, {
    bank_name: 'Vietinbank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: desc(content),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

// OCB OMNI — chung tiêu đề "Thông báo biến động số dư", KHÔNG có năm.
// TK:  "20/10 11:27\nTài khoản: 0349360265\nSố tiền: +499.000 VND \nSố dư: 499.000 VND \nNội dung: ..."
// Thẻ: "20/10 11:29 Thẻ tín dụng: 35-9586 Số tiền: +100,000 VND  Hạn mức khả dụng: ... Nội dung: ..."
// Neo vào nhãn "Tài khoản:"/"Thẻ tín dụng:" ngay sau giờ — tin cùng tiêu đề của
// bank khác ("Số dư tài khoản của bạn vừa tăng ...") không khớp.
const OCB_HEAD = /Thông báo biến động số dư\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+/.source
const OCB_TAIL = /\s+Số tiền:\s*([-+][\d.,]+)\s*VND[\s\S]{0,80}?Nội dung:\s*([^\n]{1,300})/.source

const tryOCBAccount: Parser = (text) => {
  const m = text.match(new RegExp(`${OCB_HEAD}Tài khoản:\\s*(\\d+)${OCB_TAIL}`))
  if (!m) return null
  const [, dd, mm, hh, min, acct, amountStr, content] = m
  return build(text, {
    bank_name: 'OCB',
    amount: parseVND(amountStr),
    transaction_date: vnDate(inferYear(mm, dd, hh, min), mm, dd, hh, min),
    description: desc(content),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

const tryOCBCard: Parser = (text) => {
  const m = text.match(new RegExp(`${OCB_HEAD}Thẻ tín dụng:\\s*\\d{2}-(\\d{4})${OCB_TAIL}`))
  if (!m) return null
  const [, dd, mm, hh, min, ref, amountStr, content] = m
  return build(text, {
    bank_name: 'OCB',
    amount: parseVND(amountStr),
    transaction_date: vnDate(inferYear(mm, dd, hh, min), mm, dd, hh, min),
    description: desc(content),
    source_type: 'credit_card',
    account_ref: ref,
    merchant_name: null,
  })
}

// SHB SAHA — "SHB SAHA\nPhát sinh -10,000 VND\nTài khoản 0349360265\nNGUYEN DUC HUY chuyen tien"
// Không có ngày giờ.
const trySHBSaha: Parser = (text) => {
  const m = text.match(
    /^SHB SAHA\s+Phát sinh\s+([-+][\d,.]+)\s*VND\s+Tài khoản\s+(\d+)\s+([^\n]{1,300})/,
  )
  if (!m) return null
  const [, amountStr, acct, content] = m
  return build(text, {
    bank_name: 'SHB',
    amount: parseVND(amountStr),
    transaction_date: nowVN(),
    description: desc(content),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

// HDBank TK — "Thông báo HDBank\n18/10/2026 11:30:51 TK 0349360265(VND)\n-10,000\nSD 35\n
//  SD KHA DUNG 35\nND NGUYEN DUC HUY chuyen tien"  (khác tryHDBank cũ là giao dịch thẻ)
const tryHDBankAccount: Parser = (text) => {
  const m = text.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+TK\s+(\d+)\(VND\)\s+([-+][\d,.]+)\s+SD\s[\s\S]{0,80}?\sND\s+([^\n]{1,300})/,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, ss, acct, amountStr, content] = m
  return build(text, {
    bank_name: 'HDBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: desc(content),
    source_type: 'bank',
    account_ref: last4(acct),
    merchant_name: null,
  })
}

// Cake thẻ tín dụng — "-48.750 đ\nTài khoản tín dụng, thẻ ••9526\nTại Grab* A-9VM6539GX97DAV 00 VN,
//  lúc 10:11 19/10/2026"
const tryCakeCard: Parser = (text) => {
  const m = text.match(
    /^([-+][\d.,]+)\s*đ\s+Tài khoản tín dụng, thẻ\s*[^\d\s]{0,4}(\d{4})\s+Tại\s+([^\n]{1,120}?),\s*lúc\s+(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/,
  )
  if (!m) return null
  const [, amountStr, ref, merchant, hh, min, dd, mm, yyyy] = m
  return build(text, {
    bank_name: 'Cake',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: `Tại ${merchant.trim()}`,
    source_type: 'credit_card',
    account_ref: ref,
    merchant_name: merchant.trim(),
  })
}

// Sacombank Pay — trả nợ thẻ: "Ngày 20/10/2026 08:37 Cảm ơn Quý khách đã thanh toán
//  5,000,000 VND vào thẻ Amex Platinum Credit 3779.Số dư khả dụng: ..."
// Text không có dấu: "thanh toán ... vào thẻ" luôn là tiền VÀO thẻ (dương), và luôn
// là chuyển nội bộ (trả nợ từ TK của chính mình) -> gắn kind ngay tại parser.
const trySacombankRepayment: Parser = (text) => {
  const m = text.match(
    /Ngày\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+Cảm ơn Quý khách đã thanh toán\s+([\d,.]+)\s*VND vào thẻ\s[^\n]{0,80}?(\d{4})\./,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, amountStr, ref] = m
  return build(text, {
    bank_name: 'Sacombank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: 'Thanh toán thẻ tín dụng',
    source_type: 'credit_card',
    account_ref: ref,
    merchant_name: null,
    kind: 'internal_transfer',
  })
}

/** Thứ tự không quan trọng: mỗi regex neo vào nhãn field riêng (test "khớp duy nhất"). */
export const balanceNotificationParsers: Parser[] = [
  tryBIDVAccount,
  tryVietinbank,
  tryOCBAccount,
  tryOCBCard,
  trySHBSaha,
  tryHDBankAccount,
  tryCakeCard,
  trySacombankRepayment,
]
