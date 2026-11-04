// Test parser push giao dịch thẻ + lọc tin không có số liệu + hạn giữ tin quảng cáo, với mẫu THẬT từ
// unparsed_messages production (04/11/2026). Đã đổi tên/số TK/merchant nhưng GIỮ NGUYÊN định dạng.
// Chạy: docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app \
//         denoland/deno:2.1.4 test --allow-all parsers-card-push.test.ts

import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parsers } from './parsers.ts'
import { isContentFree, isOtp, parseNotification } from './ingest.ts'
import { PROMO_RETENTION_DAYS, purgeStalePromos } from './unparsed-retention.ts'
import type { ParsedTransaction } from './types.ts'

const NOW_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/

const cases: Array<{ name: string; text: string; expect: Partial<ParsedTransaction>; nowDate?: boolean }> = [
  {
    name: 'MSB push — chi tiêu, số thẻ có ***',
    text: '-6,545,000 VND\nSố thẻ: ***7230\nHM khả dụng: 40,800,046 VND\nND: The TD MSB ***7230 thuc hien GD 6,545,000 VND luc 12:48 04/11/2026 tai CUA HANG A. HM kha dung 40,800,046 VND. LH 19006083.',
    expect: {
      bank_name: 'MSB', amount: -6545000, source_type: 'credit_card', account_ref: '7230',
      transaction_date: '2026-11-04T12:48:00+07:00', merchant_name: 'CUA HANG A',
    },
  },
  {
    name: 'MSB push — trả nợ thẻ là nội bộ',
    text: '+3,420,000 VND\nSố thẻ: ***7230\nHM khả dụng: 41,955,046 VND\nND: The TD MSB ***7230 tang 3,420,000VND vao luc 07:51 25/10/2026 tai Thanh toan the tin dung xxxx 7230. Han muc kha dung 41,955,046 VND. LH 19006083.',
    expect: {
      bank_name: 'MSB', amount: 3420000, account_ref: '7230', transaction_date: '2026-10-25T07:51:00+07:00',
      description: 'Thanh toan the tin dung xxxx 7230',
    },
  },
  {
    name: 'MSB push — hoàn tiền là cashback',
    text: '+300,000 VND\nSố thẻ: ***1981\nHM khả dụng: 47,188,303 VND\nND: QK vua nhan duoc hoan tien 300,000 VND vao the so ***1981 theo chuong trinh uu dai the From Loyalty: Cashback, LH 19006083',
    expect: { bank_name: 'MSB', amount: 300000, account_ref: '1981', kind: 'cashback' },
    nowDate: true,
  },
  {
    name: 'BIDV thẻ — chi tiêu',
    text: 'Thông báo BIDV\nThẻ 3565xx6385, số tiền 5,003,000 VND, hạn mức khả dụng tạm tính: 244,000 VND; HKD CUA HANG B 01 ; 28/10/2026 19:47:50',
    expect: {
      bank_name: 'BIDV', amount: -5003000, source_type: 'credit_card', account_ref: '6385',
      transaction_date: '2026-10-28T19:47:50+07:00', merchant_name: 'HKD CUA HANG B 01',
    },
  },
  {
    name: 'BIDV thẻ — trả nợ là nội bộ',
    text: 'Thông báo BIDV\nThẻ 4271xx9538 đã thanh toán dư nợ 6,140,000 VND thành công vào 03/11/2026 07:15:34, dư nợ sao kê còn lại cần thanh toán là 0 VND. Hạn mức khả dụng tạm tính: 13,000,000 VND',
    expect: {
      bank_name: 'BIDV', amount: 6140000, account_ref: '9538', kind: 'internal_transfer',
      transaction_date: '2026-11-03T07:15:34+07:00',
    },
  },
  {
    name: 'LPBank thẻ — chi tiêu, bỏ hậu tố ", VNM"',
    text: 'LPBank: Thông báo biến động số dư thẻ\nThời gian giao dịch: 27.10.26 19:07. Thẻ: 3567***9195. Số tiền GD: -2,581,000VND. Hạn mức còn lại: 82,030,000VND. Nội dung: HKD CUA HANG C, VNM',
    expect: {
      bank_name: 'LPBank', amount: -2581000, source_type: 'credit_card', account_ref: '9195',
      transaction_date: '2026-10-27T19:07:00+07:00', merchant_name: 'HKD CUA HANG C',
    },
  },
  {
    name: 'LPBank thẻ — trả nợ qua LPBank_APP là nội bộ',
    text: 'LPBank: Thông báo biến động số dư thẻ\nThời gian giao dịch: 03.11.26 15:20. Thẻ: 4799***5594. Số tiền GD: +9,800,000VND. Hạn mức còn lại: 97,330,000VND. Nội dung: LPBank_APP, VNM',
    expect: { bank_name: 'LPBank', amount: 9800000, account_ref: '5594', kind: 'internal_transfer', merchant_name: null },
  },
  {
    name: 'SHB SAHA thẻ — trả nợ',
    text: 'SHB SAHA\nPhát sinh +9,000,000 VND\nThẻ Mastercard Cashback*3826\nTHANH TOAN THE TIN DUNG',
    expect: { bank_name: 'SHB', amount: 9000000, source_type: 'credit_card', account_ref: '3826', description: 'THANH TOAN THE TIN DUNG' },
    nowDate: true,
  },
  {
    name: 'Eximbank — chi tiêu',
    text: 'Thông báo Eximbank\nThông báo giao dịch thẻ\n\nThẻ VISA 2244\nSử dụng tại VNPAY*CUAHANGD\nSố tiền -5,005,000 VND vào lúc 16:59:29 02/11/2026.\nHạn mức còn lại: 24,845,000 VND\nMã giao dịch: 450419.',
    expect: {
      bank_name: 'Eximbank', amount: -5005000, source_type: 'credit_card', account_ref: '2244',
      transaction_date: '2026-11-02T16:59:29+07:00', merchant_name: 'VNPAY*CUAHANGD',
    },
  },
  {
    name: 'Eximbank — hoàn trả không có dấu vẫn là tiền vào',
    text: 'Thông báo Eximbank\nThông báo hoàn trả giao dịch\n\nThẻ VISA 2244\nĐã được hoàn trả giao dịch tại VNPAY*VIVNPAY\nSố tiền 10,000 VND vào lúc 17:00:12 02/11/2026.\nMã giao dịch: 450415.',
    expect: { bank_name: 'Eximbank', amount: 10000, account_ref: '2244' },
  },
  {
    name: 'BaoVietBank — chi tiêu',
    text: 'Thẻ Visa inStyle ****7896\nNgày 25/10/2026 19:49\nGiao dịch: 39,899VND tại 9PAYTikTok Shop Seller.\nMã giao dịch: 550974. Hạn mức khả dụng: 16,147,129VND',
    expect: {
      bank_name: 'BaoVietBank', amount: -39899, source_type: 'credit_card', account_ref: '7896',
      transaction_date: '2026-10-25T19:49:00+07:00', merchant_name: '9PAYTikTok Shop Seller',
    },
  },
  {
    name: 'MB thẻ — chi tiêu',
    text: 'Thông báo biến động số dư\nMB VISA:SD THE [484804....6253]|Ngày GD: [2026-10-30 00:10:46]|Số tiền GD: -61,000 VND|TKTT: 083200001234|Nội dung GD: Giao dịch chi tiêu tại Grab* A-AXXPB4PWWLX7AV',
    expect: {
      bank_name: 'MBBank', amount: -61000, source_type: 'credit_card', account_ref: '6253',
      transaction_date: '2026-10-30T00:10:46+07:00', merchant_name: 'Grab* A-AXXPB4PWWLX7AV',
    },
  },
]

// Không phải giao dịch đã xảy ra -> không parser nào được khớp.
const nonTransactions = [
  'Thông báo giao dịch không thành công\nMB JCB: SD THE [356418....3568] [2026-10-29 17:08:36] [-1,000 VND] tai GRAB KHÔNG THÀNH CÔNG do GIÁN ĐOẠN HỆ THỐNG MB.',
  'Thẻ Visa Pla LifeStyle\nNgày 01/11/2026 15:10\nQuý khách đã thanh toán thành công 499,172VND vào tài khoản thẻ 90665286003\nHạn mức khả dụng: 16,000,000VND',
  'Sao kê thẻ tín dụng\nThe TD 7230 sao ke 20/10/26. Vui long thanh toan 6,553,257 VND, toi thieu 327,663 VND cho TKTT 80001670300 truoc 04/11/26.',
]

const matching = (text: string) => parsers.map((p) => p(text)).filter((r) => r !== null)

for (const c of cases) {
  Deno.test(`card push: ${c.name}`, () => {
    const hits = matching(c.text)
    assertEquals(hits.length, 1, 'phải khớp ĐÚNG một parser')
    const outcome = parseNotification(c.text, ['NGUYEN VAN AN'])
    assert(outcome.status === 'parsed')
    for (const [k, v] of Object.entries(c.expect)) {
      assertEquals(outcome.tx[k as keyof ParsedTransaction], v, `field ${k}`)
    }
    if (c.nowDate) assertMatch(outcome.tx.transaction_date, NOW_ISO)
  })
}

Deno.test('card push: trả nợ MSB / SHB SAHA được withKind gắn nội bộ', () => {
  for (const i of [1, 7]) {
    const o = parseNotification(cases[i].text, [])
    assert(o.status === 'parsed')
    assertEquals(o.tx.kind, 'internal_transfer', cases[i].name)
  }
})

for (const text of nonTransactions) {
  Deno.test(`card push: không khớp — ${text.slice(0, 40)}`, () => {
    assertEquals(matching(text).length, 0)
  })
}

Deno.test('card push: input 2000 ký tự gần khớp chạy nhanh (chống backtracking)', () => {
  const nearMiss = [
    'LPBank: Thông báo biến động số dư thẻ\nThời gian giao dịch: 27.10.26 19:07. Thẻ: 3567***9195. Số tiền GD: -1VND. Hạn mức còn lại: ' + '1'.repeat(1900),
    'Thông báo BIDV\nThẻ 3565xx6385, số tiền 1 VND, hạn mức khả dụng tạm tính: 1 VND; ' + 'a'.repeat(1900),
    'Thông báo biến động số dư\nMB VISA:SD THE [484804....6253]|Ngày GD: [2026-10-30 00:10:46]|Số tiền GD: -1 VND|' + 'x'.repeat(1900),
    'Thẻ Visa inStyle ****7896\nNgày 25/10/2026 19:49\nGiao dịch: 1VND tại ' + 'a'.repeat(1950),
    'QK vua nhan duoc hoan tien 1 VND ' + '1,'.repeat(950),
  ]
  for (const t of nearMiss) {
    const start = performance.now()
    matching(t)
    const ms = performance.now() - start
    assert(ms < 50, `${ms.toFixed(1)}ms cho: ${t.slice(0, 30)}`)
  }
})

Deno.test('isContentFree: tin teaser không số liệu -> bỏ; có thêm chi tiết -> giữ', () => {
  const free = [
    'Thông báo VPBank\nQuý khách có thông báo biến động số dư mới',
    'Thông báo BIDV\nQuý khách nhận được thông báo mới',
    'Thông báo HDBank\nThông báo HDBank',
    'Thông tin thanh toán\nQuý khách có thông báo thanh toán',
    'Thanh toán thẻ tín dụng thành công\nQuý khách đã thực hiện thanh toán thẻ tín dụng thành công',
  ]
  for (const t of free) assert(isContentFree(t), t)
  const kept = [
    'Thông báo VPBank\nQuý khách có thông báo biến động số dư mới: -100,000 VND',
    'Thông báo BIDV\nQuý khách đã thanh toán thành công số tiền 4,940,000 VND cho UNO 1',
    'Thông báo HDBank\nTHÔNG BÁO LIÊN KẾT THÀNH CÔNG VÍ APPLE PAY',
  ]
  for (const t of kept) assert(!isContentFree(t), t)
})

Deno.test('isOtp: xác nhận 3DS "giao dịch cần xác thực" không được lưu', () => {
  assert(isOtp('Bạn có giao dịch cần xác thực\nGiao dịch tại MOMO với số tiền là 297,116₫'))
})

Deno.test('purgeStalePromos: chỉ xoá promo của user, chưa đụng tới, cũ hơn hạn', async () => {
  const calls: Array<[string, ...unknown[]]> = []
  const chain = new Proxy({}, {
    get: (_t, op: string) => (...args: unknown[]) => {
      calls.push([op, ...args])
      return op === 'lt' ? Promise.resolve({ error: null }) : chain
    },
  })
  const now = Date.parse('2026-11-10T00:00:00Z')
  await purgeStalePromos(chain as unknown as SupabaseClient, 'u1', now)
  assertEquals(calls, [
    ['from', 'unparsed_messages'],
    ['delete'],
    ['eq', 'user_id', 'u1'],
    ['eq', 'suggested_kind', 'promo'],
    ['eq', 'resolved', false],
    ['is', 'kind', null],
    ['lt', 'received_at', new Date(now - PROMO_RETENTION_DAYS * 86_400_000).toISOString()],
  ])
})

Deno.test('purgeStalePromos: client ném exception -> chỉ log, không ném tiếp', async () => {
  const broken = { from: () => { throw new Error('network down') } } as unknown as SupabaseClient
  await purgeStalePromos(broken, 'u1')
})
