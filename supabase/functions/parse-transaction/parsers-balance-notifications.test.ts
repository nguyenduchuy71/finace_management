// Test parser "biến động số dư" + nhận diện chuyển nội bộ, với mẫu THẬT từ
// unparsed_messages (21/10/2026). Đã đổi tên/STK nhưng GIỮ NGUYÊN định dạng,
// kể cả ký tự ngăn cách U+2008 và xuống dòng.
// Chạy: docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app \
//         denoland/deno:2.1.4 test --allow-all parsers-balance-notifications.test.ts

import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { parsers } from './parsers.ts'
import { detectInternalTransfer, normalizeVN, parseOwnerNames, withKind } from './internal-transfer.ts'
import { inferYear, normalizeInput, nowVN } from './helpers.ts'
import { isOtp, parseNotification } from './ingest.ts'
import type { ParsedTransaction } from './types.ts'

const SP = ' ' // punctuation space — OCB/BIDV dùng thay dấu xuống dòng
const OWNERS = parseOwnerNames('NGUYEN VAN AN')
const NOW_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/

const cases: Array<{ name: string; text: string; expect: Partial<ParsedTransaction>; nowDate?: boolean }> = [
  {
    name: 'BIDV push TK — chi, ngăn cách U+2008, không có ngày',
    text: `Thông báo BIDV\nTài khoản thanh toán: 1440001234${SP}Số tiền GD: -499,000 VND${SP}Số dư cuối: 545,832 VND${SP}Nội dung giao dịch: MB-TKThe 0349000265_Nguyen Van An, tai OCB. ND NGUYEN VAN AN Chuyen tien -CTLNHIDO000017112357371`,
    expect: { bank_name: 'BIDV', amount: -499000, source_type: 'bank', account_ref: '1234' },
    nowDate: true,
  },
  {
    name: 'BIDV push TK — thu, ngăn cách xuống dòng + 2 dấu cách',
    text: 'Thông báo BIDV\nTài khoản thanh toán:  1440001234\nSố tiền GD:  +5,692,000 VND\nSố dư cuối:  6,128,832 VND\nNội dung giao dịch:  TKThe :6567000974, tai Techcombank. TRAN THI B chuyen tien FT26293630870608 -CTLNHIDI000017107803078-1/1-CRE-002',
    expect: { bank_name: 'BIDV', amount: 5692000, source_type: 'bank', account_ref: '1234' },
    nowDate: true,
  },
  {
    name: 'Vietinbank — chi Grab',
    text: 'Tin biến động số dư\nThời gian: 20/10/2026 17:32\nTài khoản: 104800004982\nGiao dịch: -79,000 VND\nSố dư hiện tại: 70,758 VND\nNội dung: GD thanh toan tai Grab, the 0702',
    expect: {
      bank_name: 'Vietinbank', amount: -79000, source_type: 'bank', account_ref: '4982',
      transaction_date: '2026-10-20T17:32:00+07:00', description: 'GD thanh toan tai Grab, the 0702',
    },
  },
  {
    name: 'Vietinbank — đảo giao dịch (DAO) giữ dấu +',
    text: 'Tin biến động số dư\nThời gian: 20/10/2026 17:33\nTài khoản: 104800004982\nGiao dịch: +1,000 VND\nSố dư hiện tại: 71,758 VND\nNội dung: (DAO)GD thanh toan tai GRAB, the 0702',
    expect: { bank_name: 'Vietinbank', amount: 1000, description: '(DAO)GD thanh toan tai GRAB, the 0702' },
  },
  {
    name: 'OCB TK — U+2008, số tiền dấu chấm',
    text: `Thông báo biến động số dư\n20/10 11:30${SP}Tài khoản: 0349000265${SP}Số tiền: -199.000 VND ${SP}Số dư: 0 VND ${SP}Nội dung: THANH TOAN THE TIN DUNG`,
    expect: {
      bank_name: 'OCB', amount: -199000, source_type: 'bank', account_ref: '0265',
      description: 'THANH TOAN THE TIN DUNG',
    },
  },
  {
    name: 'OCB TK — xuống dòng',
    text: 'Thông báo biến động số dư\n20/10 11:27\nTài khoản: 0349000265\nSố tiền: +499.000 VND \nSố dư: 499.000 VND \nNội dung: NGUYEN VAN AN Chuyen tien',
    expect: { bank_name: 'OCB', amount: 499000, source_type: 'bank', account_ref: '0265', description: 'NGUYEN VAN AN Chuyen tien' },
  },
  {
    name: 'OCB thẻ tín dụng — trả nợ (plan 261020)',
    text: `Thông báo biến động số dư\n20/10 11:29${SP}Thẻ tín dụng: 35-9586${SP}Số tiền: +100,000 VND${SP}${SP}Hạn mức khả dụng: 48,853,000 ${SP}Nội dung: THANH TOAN THE TIN DUNG`,
    expect: { bank_name: 'OCB', amount: 100000, source_type: 'credit_card', account_ref: '9586' },
  },
  {
    name: 'SHB SAHA — chi, không có ngày',
    text: 'SHB SAHA\nPhát sinh -10,000 VND\nTài khoản 0349000265\nNGUYEN VAN AN chuyen tien',
    expect: { bank_name: 'SHB', amount: -10000, source_type: 'bank', account_ref: '0265', description: 'NGUYEN VAN AN chuyen tien' },
    nowDate: true,
  },
  {
    name: 'SHB SAHA — thu kèm mã GD',
    text: 'SHB SAHA\nPhát sinh +10,000 VND\nTài khoản 0349000265\nNGUYEN VAN AN chuyen tien(GD#499745)',
    expect: { bank_name: 'SHB', amount: 10000, description: 'NGUYEN VAN AN chuyen tien(GD#499745)' },
    nowDate: true,
  },
  {
    name: 'HDBank TK',
    text: 'Thông báo HDBank\n18/10/2026 11:30:51 TK 0349000265(VND)\n-10,000\nSD 35\nSD KHA DUNG 35\nND NGUYEN VAN AN chuyen tien',
    expect: {
      bank_name: 'HDBank', amount: -10000, source_type: 'bank', account_ref: '0265',
      transaction_date: '2026-10-18T11:30:51+07:00', description: 'NGUYEN VAN AN chuyen tien',
    },
  },
  {
    name: 'Cake thẻ tín dụng — chi Grab',
    text: '-48.750 đ\nTài khoản tín dụng, thẻ ••9526\nTại Grab* A-9VM6539GX97DAV 00 VN, lúc 10:11 19/10/2026',
    expect: {
      bank_name: 'Cake', amount: -48750, source_type: 'credit_card', account_ref: '9526',
      transaction_date: '2026-10-19T10:11:00+07:00', merchant_name: 'Grab* A-9VM6539GX97DAV 00 VN',
    },
  },
  {
    name: 'Sacombank Pay — trả nợ thẻ là chuyển nội bộ',
    text: 'Sacombankpay: Thông báo\nNgày 20/10/2026 08:37 Cảm ơn Quý khách đã thanh toán 5,000,000 VND vào thẻ Amex Platinum Credit 3779.Số dư khả dụng: 26,381,042 VND. Liên hệ 1800585888/+842835266060',
    expect: {
      bank_name: 'Sacombank', amount: 5000000, source_type: 'credit_card', account_ref: '3779',
      transaction_date: '2026-10-20T08:37:00+07:00', kind: 'internal_transfer',
    },
  },
]

// Tin KHÔNG phải giao dịch hoặc chưa rõ bank -> không parser nào được khớp.
const nonTransactions = [
  'Thông báo HDBank\nThe 4987**5858: Tong du no: 1,219,710 VND. So tien thanh toan toi thieu 36,591 VND. QK vui long thanh toan truoc 16h30 ngay 04/11/26.',
  'SacombankPay : Ðăng ký trả góp\nThẻ Amex Platinum Credit 3779 giao dịch 5,872,362 tại cửa hàng CT TNHH HK đã đủ điều kiện trả góp. Chạm để đăng ký ngay.',
  'Thông báo VPBank\nQuý khách có thông báo biến động số dư mới',
  'Thông báo biến động số dư\nSố dư tài khoản của bạn vừa tăng 10.000 đ. Nội dung: NGUYEN VAN AN chuyen tien. Số dư hiện tại của tài khoản thanh toán là 10.020 đ',
  '🚨 GIỜ VÀNG GIAO DỊCH HOÀN 50% Giao dịch từ 100.000đ trên App HDBank: ✔️ Hoàn 50% tối đa 50.000đ',
]

const matching = (text: string) => parsers.map((p) => p(text)).filter((r) => r !== null)

for (const c of cases) {
  Deno.test(`balance: ${c.name}`, () => {
    const hits = matching(c.text)
    assertEquals(hits.length, 1, 'phải khớp ĐÚNG một parser')
    const r = hits[0]!
    for (const [k, v] of Object.entries(c.expect)) {
      assertEquals(r[k as keyof ParsedTransaction], v, `field ${k}`)
    }
    if (c.nowDate) assertMatch(r.transaction_date, NOW_ISO)
    assertEquals(r.currency, 'VND')
    assertEquals(r.raw_text, c.text)
  })
}

for (const text of nonTransactions) {
  Deno.test(`balance: không khớp — ${text.slice(0, 40)}`, () => {
    assertEquals(matching(text).length, 0)
  })
}

Deno.test('balance: input 2000 ký tự gần khớp chạy nhanh (chống backtracking)', () => {
  const nearMiss = [
    'Thông báo biến động số dư\n20/10 11:30 Tài khoản: 1 Số tiền: +1 VND ' + 'x'.repeat(1900),
    'Tài khoản thanh toán: 1 Số tiền GD: -1 VND Số dư cuối: ' + '1,'.repeat(950),
    '-1 đ\nTài khoản tín dụng, thẻ ••9526\nTại ' + 'a'.repeat(1950),
    'Ngày 20/10/2026 08:37 Cảm ơn Quý khách đã thanh toán 1 VND vào thẻ ' + 'a'.repeat(1900),
    '18/10/2026 11:30:51 TK 1(VND)\n-1\nSD ' + 'S'.repeat(1950),
  ]
  for (const t of nearMiss) {
    const start = performance.now()
    matching(t)
    const ms = performance.now() - start
    assert(ms < 50, `${ms.toFixed(1)}ms cho: ${t.slice(0, 30)}`)
  }
})

Deno.test('nowVN: giờ VN +07:00', () => {
  assertEquals(nowVN(Date.UTC(2026, 9, 20, 20, 5, 9)), '2026-10-21T03:05:09+07:00')
})

Deno.test('normalizeVN / parseOwnerNames: bỏ dấu, gộp trùng, bỏ tên quá ngắn', () => {
  assertEquals(normalizeVN('  Nguyễn  Đức Huy '), 'NGUYEN DUC HUY')
  assertEquals(parseOwnerNames('Nguyễn Văn An; NGUYEN VAN AN;;ab'), ['NGUYEN VAN AN'])
  assertEquals(parseOwnerNames(undefined), [])
})

Deno.test('detectInternalTransfer', () => {
  const yes: Array<[string, number]> = [
    ['THANH TOAN THE TIN DUNG', -199000],
    ['Thanh toán thẻ tín dụng', 100000],
    ['NGUYEN VAN AN Chuyen tien', 499000],
    ['CT DEN:908T26A0XZ5VGENU NGUYEN VAN AN Chuyen tien', 100000],
    ['Nguyen Van An;NGUYEN VAN AN chuyen tien', 10000],
    ['MB-TKThe 0349000265_Nguyen Van An, tai OCB. ND NGUYEN VAN AN Chuyen tien', -499000],
    ['80001670300-Ref 6291MCOBQ2CIY6AY-CK 24/7 cho 0349000265-NGUYEN VAN AN chuyen tien', -10000],
  ]
  const no: Array<[string, number]> = [
    // tiền RA, tên mình chỉ là người gửi -> có thể chuyển cho người khác
    ['NGUYEN VAN AN chuyen tien', -10000],
    ['MB-TKThe 838628000996_TRAN HONG Q, tai Techcombank. ND An chuyen khoan nhanh qua Zalo', -84000],
    ['TKThe :6567000974, tai Techcombank. TRAN THI B chuyen tien', 5692000],
    ['GD thanh toan tai Grab, the 0702', -79000],
    // tên khác chỉ trùng một phần
    ['NGUYEN VAN ANH chuyen tien', 10000],
  ]
  for (const [d, a] of yes) assert(detectInternalTransfer(d, a, OWNERS), `phải là nội bộ: ${d} (${a})`)
  for (const [d, a] of no) assert(!detectInternalTransfer(d, a, OWNERS), `không phải nội bộ: ${d} (${a})`)
  assert(!detectInternalTransfer('NGUYEN VAN AN chuyen tien', 10000, []), 'không có OWNER_NAMES -> chỉ dựa vào trả nợ thẻ')
})

Deno.test('withKind: giữ kind parser đã set, còn lại suy từ nội dung', () => {
  const base = matching(cases[5].text)[0]!
  assertEquals(withKind(base, OWNERS).kind, 'internal_transfer')
  assertEquals(withKind(base, []).kind, 'normal')
  const sacom = matching(cases[11].text)[0]!
  assertEquals(withKind(sacom, []).kind, 'internal_transfer')
})

// Thông báo iOS thật về dạng NFD (dấu tách rời) — regex chỉ khớp sau normalizeInput.
Deno.test('balance: mẫu dạng NFD khớp sau normalizeInput, không khớp nếu bỏ chuẩn hoá', () => {
  for (const c of cases) {
    const nfd = c.text.normalize('NFD')
    assertEquals(matching(normalizeInput(nfd)).length, 1, c.name)
  }
  // chứng minh test có ý nghĩa: ít nhất một mẫu NFD thô không khớp
  assert(cases.some((c) => matching(c.text.normalize('NFD')).length === 0))
})

Deno.test('balance: tin không có ngày dùng thời điểm nhận được truyền vào (backfill)', () => {
  const receivedAt = Date.UTC(2026, 9, 19, 9, 35, 0) // 16:35 giờ VN
  for (const c of cases.filter((c) => c.nowDate)) {
    const r = parsers.map((p) => p(c.text, receivedAt)).find((x) => x !== null)!
    assertEquals(r.transaction_date, '2026-10-19T16:35:00+07:00', c.name)
  }
})

Deno.test('detectInternalTransfer: phí có cụm "thanh toán thẻ tín dụng" vẫn là chi thật', () => {
  assert(!detectInternalTransfer('PHI DICH VU THANH TOAN THE TIN DUNG', -11000, OWNERS))
  assert(!detectInternalTransfer('Phí thanh toán thẻ tín dụng', -11000, OWNERS))
})

Deno.test('parseNotification: số tiền 0 -> invalid, không ghi giao dịch', () => {
  const r = parseNotification('SHB SAHA\nPhát sinh +0 VND\nTài khoản 0349000265\nX', OWNERS)
  assertEquals(r, { status: 'invalid', bank: 'SHB' })
})

Deno.test('isOtp: có dấu / không dấu / OTP', () => {
  assert(isOtp('Mã xác thực của bạn là 123456'))
  assert(isOtp('Ma xac thuc: 123456'))
  assert(isOtp('OTP 123456'))
  assert(!isOtp('SHB SAHA\nPhát sinh -10,000 VND\nTài khoản 0349000265\nchuyen tien'))
})

// Edge runtime chạy UTC: 00:30 ngày 01/01/2027 giờ VN vẫn là 2026 theo UTC.
Deno.test('inferYear: theo giờ VN, không theo TZ runtime', () => {
  const vn = (iso: string) => Date.parse(iso)
  assertEquals(inferYear('01', '01', '00', '05', vn('2027-01-01T00:30:00+07:00')), '2027')
  assertEquals(inferYear('12', '31', '23', '58', vn('2027-01-01T00:01:00+07:00')), '2026')
  assertEquals(inferYear('10', '20', '11', '30', vn('2026-10-21T09:00:00+07:00')), '2026')
})
