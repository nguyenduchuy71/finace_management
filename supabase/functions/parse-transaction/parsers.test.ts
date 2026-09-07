// Test parser với sample text THẬT của từng ngân hàng.
// Chạy: deno test --allow-all supabase/functions/parse-transaction/parsers.test.ts

import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { parsers } from './parsers.ts'
import type { ParsedTransaction } from './types.ts'

function parse(text: string): ParsedTransaction | null {
  for (const p of parsers) {
    const r = p(text)
    if (r) return r
  }
  return null
}

const cases: Array<{
  name: string
  text: string
  expect: Partial<ParsedTransaction>
}> = [
  {
    // Dinh dang THAT tu app LPBank (xac nhan 07/09/2026)
    name: 'LPBank app notification',
    text: '07/09/2026|15:08|Tài khoản:0349360265|Số tiền GD:2,000|Số dư:2,001  VND|Nội dung:249375-NGUYEN DUC HUY Chuyen tien|DT: *8668',
    expect: {
      bank_name: 'LPBank', amount: 2000, source_type: 'bank',
      account_ref: '0265',   // 4 so cuoi cua TK 0349360265 (source_type='bank')
      transaction_date: '2026-09-07T15:08:00+07:00',
      description: '249375-NGUYEN DUC HUY Chuyen tien',
    },
  },
  {
    name: 'LPBank SMS',
    text: 'TK 03xxx265 -430VND 01092026 19:35 SD:44VND ND: Thu phi QLTK thang 082026',
    expect: {
      bank_name: 'LPBank', amount: -430, source_type: 'bank',
      account_ref: 'x265', transaction_date: '2026-09-01T19:35:00+07:00',
      description: 'Thu phi QLTK thang 082026',
    },
  },
  {
    name: 'SHB',
    text: 'THE MASTERCARD CASHBACK 3826 SU DUNG -2,007,000 VND TAI HKD DAI DUONG NGAY 03/09/26 19:35. HM CON LAI TAM TINH 10,000,000',
    expect: {
      bank_name: 'SHB', amount: -2007000, source_type: 'credit_card',
      account_ref: '3826', merchant_name: 'HKD DAI DUONG',
      transaction_date: '2026-09-03T19:35:00+07:00',
    },
  },
  {
    name: 'HDBank',
    text: 'The 5858 thuc hien GD: 10,005,000 VND tai MEGAPAY*ABC, MGD: 651219, ngay 22/08/2026 10:49:27. HM con lai 5,000,000',
    expect: {
      bank_name: 'HDBank', amount: -10005000, source_type: 'credit_card',
      account_ref: '5858', merchant_name: 'MEGAPAY*ABC',
      transaction_date: '2026-08-22T10:49:27+07:00',
    },
  },
  {
    name: 'MSB',
    text: 'The TD MSB 7230 thuc hien GD 3,520,000 VND luc 14:13 07/08/2026 tai MNAUMY. HM kha dung 1,000,000',
    expect: {
      bank_name: 'MSB', amount: -3520000, source_type: 'credit_card',
      account_ref: '7230', merchant_name: 'MNAUMY',
      transaction_date: '2026-08-07T14:13:00+07:00',
    },
  },
  {
    name: 'VPBank chi tieu',
    text: 'The VPBank 5239...9808 vua chi tieu -5,061,000VND ND:MEGAPAY*XYZ vao luc 13:17 24/08.',
    expect: {
      bank_name: 'VPBank', amount: -5061000, source_type: 'credit_card',
      account_ref: '9808', merchant_name: 'MEGAPAY*XYZ',
    },
  },
  {
    name: 'VPBank tang (income)',
    text: 'The VPBank 5239...9808 tang +5,000,000VND ND:GD qua NHDT vao luc 08:49 28/08.',
    expect: {
      bank_name: 'VPBank', amount: 5000000, source_type: 'credit_card',
      account_ref: '9808',
    },
  },
  {
    name: 'WOORIVN',
    text: 'Giao dich thanh cong So the 4074***2789 16-08-26/10:03/3,006,000 VND /NL-ALEPAY*KMPHONG1, VN,Han muc con lai: 1,000,000',
    expect: {
      bank_name: 'WOORIVN', amount: -3006000, source_type: 'credit_card',
      account_ref: '2789', merchant_name: 'NL-ALEPAY*KMPHONG1',
      transaction_date: '2026-08-16T10:03:00+07:00',
    },
  },
  {
    name: 'UOB',
    text: 'Nhan tien vao Tai khoan/Credited to Account: *0568. So tien/Amount: VND 4,827,000. Ngay/Date: 18/07/26 18:10. Ref: 3589.',
    expect: {
      bank_name: 'UOB', amount: 4827000, source_type: 'bank',
      account_ref: '0568', transaction_date: '2026-07-18T18:10:00+07:00',
    },
  },
  {
    name: 'Sacombank',
    text: 'Ngày 01/09/2026 16:25 thẻ Visa UNIQ Pla Credit 4682 giao dịch 500,000 VND tại AEON MALL',
    expect: {
      bank_name: 'Sacombank', amount: -500000, source_type: 'credit_card',
      account_ref: '4682', merchant_name: 'AEON MALL',
      transaction_date: '2026-09-01T16:25:00+07:00',
    },
  },
  {
    name: 'MoMo',
    text: 'Bạn đã thực hiện thanh toán thành công cho KAI COFFEE với số tiền 39.000đ.',
    expect: {
      bank_name: 'MoMo', amount: -39000, source_type: 'bank',
      merchant_name: 'KAI COFFEE', account_ref: null,
    },
  },
  {
    name: 'BIDV',
    text: 'BIDV xin thông báo tới Quý khách Thời gian giao dịch: 07:27 07/09/2026 Số tài khoản: 1234 Số tiền GD: -50,000 VND Nội dung giao dịch: Thanh toan hoa don Mã giao dịch: 999',
    expect: {
      bank_name: 'BIDV', amount: -50000, source_type: 'bank',
      transaction_date: '2026-09-07T07:27:00+07:00',
    },
  },
]

for (const c of cases) {
  Deno.test(`parser: ${c.name}`, () => {
    const got = parse(c.text)
    if (!got) throw new Error(`KHÔNG parser nào khớp: ${c.name}`)
    for (const [k, v] of Object.entries(c.expect)) {
      assertEquals(got[k as keyof ParsedTransaction], v, `${c.name}.${k}`)
    }
    assertEquals(got.raw_text, c.text, `${c.name}.raw_text`)
  })
}

Deno.test('OTP không bị parse nhầm thành giao dịch', () => {
  assertEquals(parse('Ma xac thuc OTP cua ban la 123456'), null)
})

// Ký tự wildcard của LIKE có thể lọt vào account_ref qua last4() vì bank mask
// số thẻ theo nhiều kiểu. Test này khoá lại hành vi đó để nhớ phải escape ở index.ts.
Deno.test('account_ref có thể chứa wildcard -> BẮT BUỘC escape trước khi .like()', () => {
  const got = parse('The VPBank 5239...9%08 vua chi tieu -5,061,000VND ND:X vao luc 13:17 24/08.')
  assertEquals(got?.account_ref, '9%08')
})
