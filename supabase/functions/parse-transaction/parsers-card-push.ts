// Parser push app cho GIAO DỊCH THẺ TÍN DỤNG: MSB (trả nợ / hoàn tiền), BIDV, LPBank, SHB SAHA, Eximbank,
// BaoVietBank, MB. Mẫu THẬT lấy từ `unparsed_messages` production (04/11/2026).
// Quy ước như parsers-balance-notifications.ts: số tiền nhóm nghìn đúng chuẩn (AMT), khoảng trống có cận trên,
// không `.*?` không neo. Ngân hàng xác định bằng tiêu đề / nhãn riêng của từng app.

import type { Parser } from './types.ts'
import { nowVN, parseVND, vnDate } from './helpers.ts'
import { build } from './parser-build.ts'

/** Số tiền nhóm nghìn chuẩn hoặc số thuần, không có phần lẻ. */
const AMT = /(?:\d{1,3}(?:[.,]\d{3})+|\d+)/.source

// MSB — tiền VÀO thẻ (trả nợ): "ND: The TD MSB ***7230 tang 3,420,000VND vao luc 07:51 25/10/2026
//  tai Thanh toan the tin dung xxxx 7230. Han muc kha dung ..." (chi tiêu cùng định dạng: tryMSB)
const tryMSBCredit: Parser = (text) => {
  const m = text.match(new RegExp(
    `The TD MSB\\s*\\**(\\d{4})\\s+tang\\s+(${AMT})\\s*VND\\s+vao luc\\s+(\\d{2}):(\\d{2})\\s+(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+tai\\s+([^\\n]{1,120}?)\\.\\s`,
  ))
  if (!m) return null
  const [, card, amountStr, hh, min, dd, mm, yyyy, content] = m
  return build(text, {
    bank_name: 'MSB',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: content.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: null,
  })
}

// MSB — hoàn tiền: "ND: QK vua nhan duoc hoan tien 300,000 VND vao the so ***1981 theo chuong trinh uu dai
//  the From Loyalty: Cashback". Không có ngày giờ.
const tryMSBCashback: Parser = (text, now) => {
  const m = text.match(new RegExp(
    `QK vua nhan duoc hoan tien\\s+(${AMT})\\s*VND\\s+vao the so\\s*\\**(\\d{4})\\s+theo chuong trinh`,
  ))
  if (!m) return null
  const [, amountStr, card] = m
  return build(text, {
    bank_name: 'MSB',
    amount: parseVND(amountStr),
    transaction_date: nowVN(now),
    description: 'Hoàn tiền thẻ tín dụng',
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: null,
    kind: 'cashback',
  })
}

// BIDV thẻ — chi tiêu: "Thông báo BIDV\nThẻ 3565xx6385, số tiền 5,003,000 VND, hạn mức khả dụng tạm tính:
//  244,000 VND; HKD TRINH THANH LAN 01 ; 28/10/2026 19:47:50"
const tryBIDVCardSpend: Parser = (text) => {
  const m = text.match(new RegExp(
    `^Thông báo BIDV\\s+Thẻ \\d{4}xx(\\d{4}), số tiền (${AMT}) VND, hạn mức khả dụng tạm tính: ${AMT} VND;\\s*([^;\\n]{1,120}?)\\s*;\\s*(\\d{2})\\/(\\d{2})\\/(\\d{4}) (\\d{2}):(\\d{2}):(\\d{2})`,
  ))
  if (!m) return null
  const [, card, amountStr, merchant, dd, mm, yyyy, hh, min, ss] = m
  return build(text, {
    bank_name: 'BIDV',
    amount: -parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// BIDV thẻ — trả nợ (luôn là tiền VÀO thẻ từ TK của mình -> nội bộ): "Thông báo BIDV\nThẻ 3565xx6385 đã thanh
//  toán dư nợ 6,856,000 VND thành công vào 03/11/2026 07:15:11, dư nợ sao kê còn lại ..."
const tryBIDVCardRepayment: Parser = (text) => {
  const m = text.match(new RegExp(
    `^Thông báo BIDV\\s+Thẻ \\d{4}xx(\\d{4}) đã thanh toán dư nợ (${AMT}) VND thành công vào (\\d{2})\\/(\\d{2})\\/(\\d{4}) (\\d{2}):(\\d{2}):(\\d{2})`,
  ))
  if (!m) return null
  const [, card, amountStr, dd, mm, yyyy, hh, min, ss] = m
  return build(text, {
    bank_name: 'BIDV',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: 'Thanh toán thẻ tín dụng',
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: null,
    kind: 'internal_transfer',
  })
}

// LPBank thẻ: "LPBank: Thông báo biến động số dư thẻ\nThời gian giao dịch: 27.10.26 19:07. Thẻ: 3567***9195.
//  Số tiền GD: -2,581,000VND. Hạn mức còn lại: 82,030,000VND. Nội dung: HKD DINH THANG 94 M2, VNM"
// Tiền VÀO thẻ với nội dung "LPBank_APP" = trả nợ từ app LPBank (tin TK cùng phút ghi "Thanh toan du no ... the tin
// dung") -> nội bộ. Hậu tố quốc gia ", VN"/", VNM" bị bỏ khỏi nội dung.
const tryLPBankCard: Parser = (text) => {
  const m = text.match(new RegExp(
    `^LPBank: Thông báo biến động số dư thẻ\\s+Thời gian giao dịch: (\\d{2})\\.(\\d{2})\\.(\\d{2}) (\\d{2}):(\\d{2})\\. Thẻ: \\d{4}\\*{3}(\\d{4})\\. Số tiền GD: ([-+]${AMT})\\s*VND\\. Hạn mức còn lại: [^\\n]{0,40}?Nội dung: ([^\\n]{1,200}?)(?:, VNM?)?$`,
    'm',
  ))
  if (!m) return null
  const [, dd, mm, yy, hh, min, card, amountStr, content] = m
  return build(text, {
    bank_name: 'LPBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yy, mm, dd, hh, min),
    description: content.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: amountStr.startsWith('-') ? content.trim() : null,
    kind: amountStr.startsWith('+') && content.trim() === 'LPBank_APP' ? 'internal_transfer' : undefined,
  })
}

// SHB SAHA thẻ: "SHB SAHA\nPhát sinh +9,000,000 VND\nThẻ Mastercard Cashback*3826\nTHANH TOAN THE TIN DUNG"
// (TK cùng tiêu đề: trySHBSaha). Không có ngày giờ.
const trySHBSahaCard: Parser = (text, now) => {
  const m = text.match(new RegExp(
    `^SHB SAHA\\s+Phát sinh\\s+([-+]${AMT})\\s*VND\\s+Thẻ [^\\n*]{1,40}\\*(\\d{4})\\s+([^\\n]{1,300})`,
  ))
  if (!m) return null
  const [, amountStr, card, content] = m
  return build(text, {
    bank_name: 'SHB',
    amount: parseVND(amountStr),
    transaction_date: nowVN(now),
    description: content.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: null,
  })
}

// Eximbank — chi tiêu: "Thẻ VISA 2244\nSử dụng tại VNPAY*UYENMINH\nSố tiền -5,005,000 VND vào lúc 16:59:29 02/11/2026."
// Hoàn trả: "Thẻ VISA 2244\nĐã được hoàn trả giao dịch tại VNPAY*VIVNPAY\nSố tiền 10,000 VND vào lúc ..." (không dấu).
// Dấu suy từ động từ, không từ text: "Sử dụng" luôn là chi, "hoàn trả" luôn là thu.
const tryEximbankCard: Parser = (text) => {
  const m = text.match(new RegExp(
    `^Thông báo Eximbank\\s+Thông báo [^\\n]{1,40}\\s+Thẻ [A-Za-z]{2,12} (\\d{4})\\s+(Sử dụng tại|Đã được hoàn trả giao dịch tại)\\s+([^\\n]{1,120})\\s+Số tiền [-+]?(${AMT}) VND vào lúc (\\d{2}):(\\d{2}):(\\d{2}) (\\d{2})\\/(\\d{2})\\/(\\d{4})`,
  ))
  if (!m) return null
  const [, card, verb, merchant, amountStr, hh, min, ss, dd, mm, yyyy] = m
  const amount = parseVND(amountStr)
  return build(text, {
    bank_name: 'Eximbank',
    amount: verb.startsWith('Sử dụng') ? -amount : amount,
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: verb.startsWith('Sử dụng') ? merchant.trim() : `Hoàn trả: ${merchant.trim()}`,
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// BaoVietBank — chi tiêu: "Thẻ Visa inStyle ****7896\nNgày 25/10/2026 19:49\nGiao dịch: 39,899VND tại 9PAYTikTok
//  Shop Seller.\nMã giao dịch: 550974. Hạn mức khả dụng: ..."
const tryBaoVietCard: Parser = (text) => {
  const m = text.match(new RegExp(
    `^Thẻ [^\\n*]{1,40}\\*{4}(\\d{4})\\s+Ngày (\\d{2})\\/(\\d{2})\\/(\\d{4}) (\\d{2}):(\\d{2})\\s+Giao dịch: (${AMT})\\s*VND tại ([^\\n]{1,120}?)\\.\\s+Mã giao dịch:`,
  ))
  if (!m) return null
  const [, card, dd, mm, yyyy, hh, min, amountStr, merchant] = m
  return build(text, {
    bank_name: 'BaoVietBank',
    amount: -parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min),
    description: merchant.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant.trim(),
  })
}

// MB thẻ: "MB VISA:SD THE [484804....6253]|Ngày GD: [2026-10-30 00:10:46]|Số tiền GD: -61,000 VND|TKTT: 0832...|
//  Nội dung GD: Giao dịch chi tiêu tại Grab* A-AXX..."  (tin "KHÔNG THÀNH CÔNG" có định dạng khác -> không khớp)
const tryMBCard: Parser = (text) => {
  const m = text.match(new RegExp(
    `MB [A-Z]{2,12}:SD THE \\[\\d{6}\\.{4}(\\d{4})\\]\\|Ngày GD: \\[(\\d{4})-(\\d{2})-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2})\\]\\|Số tiền GD: ([-+]${AMT}) VND\\|[^\\n]{0,40}?Nội dung GD: ([^\\n|]{1,200})`,
  ))
  if (!m) return null
  const [, card, yyyy, mm, dd, hh, min, ss, amountStr, content] = m
  const merchant = content.match(/tại\s+([^\n]{1,120})/)?.[1]?.trim() ?? null
  return build(text, {
    bank_name: 'MBBank',
    amount: parseVND(amountStr),
    transaction_date: vnDate(yyyy, mm, dd, hh, min, ss),
    description: content.trim(),
    source_type: 'credit_card',
    account_ref: card,
    merchant_name: merchant,
  })
}

/** Mỗi regex neo vào tiêu đề / nhãn riêng của từng app nên thứ tự không quan trọng. */
export const cardPushParsers: Parser[] = [
  tryMSBCredit,
  tryMSBCashback,
  tryBIDVCardSpend,
  tryBIDVCardRepayment,
  tryLPBankCard,
  trySHBSahaCard,
  tryEximbankCard,
  tryBaoVietCard,
  tryMBCard,
]
