// Thứ tự mảng `parsers` đi qua đường công khai parseNotification (như index/backfill dùng):
// mỗi mẫu THẬT phải rơi đúng bank ngay cả khi có parser khác đứng trước nó.
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { parseNotification } from './ingest.ts'

const SP = ' '
const samples: Array<[string, string, number]> = [
  ['LPBank', '07/09/2026|15:08|Tài khoản:0349360265|Số tiền GD:2,000|Số dư:2,001  VND|Nội dung:249375-NGUYEN DUC HUY Chuyen tien|DT: *8668', 2000],
  ['LPBank', 'TK 03xxx265 -430VND 01092026 19:35 SD:44VND ND: Thu phi QLTK thang 082026', -430],
  ['SHB', 'THE MASTERCARD CASHBACK 3826 SU DUNG -2,007,000 VND TAI HKD DAI DUONG NGAY 03/09/26 19:35. HM CON LAI TAM TINH 10,000,000', -2007000],
  ['HDBank', 'The 5858 thuc hien GD: 10,005,000 VND tai MEGAPAY*ABC, MGD: 651219, ngay 22/08/2026 10:49:27. HM con lai 5,000,000', -10005000],
  ['MSB', 'The TD MSB 7230 thuc hien GD 3,520,000 VND luc 14:13 07/08/2026 tai MNAUMY. HM kha dung 1,000,000', -3520000],
  ['VPBank', 'The VPBank 5239...9808 vua chi tieu -5,061,000VND ND:MEGAPAY*XYZ vao luc 13:17 24/08.', -5061000],
  ['WOORIVN', 'Giao dich thanh cong So the 4074***2789 16-08-26/10:03/3,006,000 VND /NL-ALEPAY*KMPHONG1, VN,Han muc con lai: 1,000,000', -3006000],
  ['UOB', 'Nhan tien vao Tai khoan/Credited to Account: *0568. So tien/Amount: VND 4,827,000. Ngay/Date: 18/07/26 18:10. Ref: 3589.', 4827000],
  ['Sacombank', 'Ngày 01/09/2026 16:25 thẻ Visa UNIQ Pla Credit 4682 giao dịch 500,000 VND tại AEON MALL', -500000],
  ['MoMo', 'Bạn đã thực hiện thanh toán thành công cho KAI COFFEE với số tiền 39.000đ.', -39000],
  ['BIDV', 'BIDV xin thông báo tới Quý khách Thời gian giao dịch: 07:27 07/09/2026 Số tài khoản: 1234 Số tiền GD: -50,000 VND Nội dung giao dịch: Thanh toan hoa don Mã giao dịch: 999', -50000],
  ['BIDV', 'Thông báo BIDV\nTài khoản thanh toán:  1440001234\nSố tiền GD:  +5,692,000 VND\nSố dư cuối:  6,128,832 VND\nNội dung giao dịch:  TKThe :6567000974, tai Techcombank. TRAN THI B chuyen tien', 5692000],
  ['Vietinbank', 'Tin biến động số dư\nThời gian: 20/10/2026 17:32\nTài khoản: 104800004982\nGiao dịch: -79,000 VND\nSố dư hiện tại: 70,758 VND\nNội dung: GD thanh toan tai Grab, the 0702', -79000],
  ['OCB', `Thông báo biến động số dư\n20/10 11:30${SP}Tài khoản: 0349000265${SP}Số tiền: -199.000 VND ${SP}Số dư: 0 VND ${SP}Nội dung: THANH TOAN THE TIN DUNG`, -199000],
  ['SHB', 'SHB SAHA\nPhát sinh -10,000 VND\nTài khoản 0349000265\nNGUYEN VAN AN chuyen tien', -10000],
]

for (const [bank, text, amount] of samples) {
  Deno.test(`parseNotification thứ tự: ${bank} ${amount}`, () => {
    const r = parseNotification(text, [], Date.parse('2026-10-20T12:00:00+07:00'))
    if (r.status !== 'parsed') throw new Error(`${bank}: status ${r.status}`)
    assertEquals([r.tx.bank_name, r.tx.amount], [bank, amount])
  })
}

Deno.test('parseNotification: không khớp -> no_match; khớp nhưng tiền 0 -> invalid', () => {
  assertEquals(parseNotification('xin chao', []).status, 'no_match')
  assertEquals(parseNotification('TK 03xxx265 -0VND 01092026 19:35 SD:44VND ND: x', []).status, 'invalid')
})
