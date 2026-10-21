// classifyUnparsed với mẫu THẬT (đã đổi tên/STK). Đo trên toàn bộ 99 tin của
// unparsed_messages (21/10/2026): 31/31 giao dịch -> transaction, 3/3 nhắc thẻ,
// 62 promo, 0 giao dịch bị gắn promo.
// Chạy: docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app \
//         denoland/deno:2.1.4 test --allow-all classify-unparsed.test.ts

import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { classifyUnparsed, type SuggestedKind } from './classify-unparsed.ts'
import { normalizeInput } from './helpers.ts'

const SP = ' '

const samples: Array<[SuggestedKind, string]> = [
  // --- giao dịch chưa có parser (bank chưa rõ) — PHẢI hiện trong hộp tin
  ['transaction', 'Thông báo ghi có\nTài khoản **0265 thay đổi +  VND 10,000.\nSố dư khả dụng: VND 97,600.\nNguyen Van An;NGUYEN VAN AN chuyen tien'],
  ['transaction', '-10,000 VND\nTài khoản: 800xx0300\nSố dư: 0 VND\nND: 80001670300-Ref 6291MCOBQ2CIY6AY-CK 24/7 cho 0349000265-NGUYEN VAN AN chuyen tien'],
  ['transaction', '+10,000 VND\nTài khoản: 800xx0300\nSố dư: 10,000 VND\nND: 80001670300-6291YOLOP2M9ZE57-Chuyen khoan tu Cake'],
  ['transaction', 'Thông báo biến động số dư\nSố dư tài khoản của bạn vừa tăng 10.000 đ. Nội dung: NGUYEN VAN AN chuyen tien. Số dư hiện tại của tài khoản thanh toán là 10.020 đ'],
  ['transaction', 'Thông báo VPBank\nQuý khách có thông báo biến động số dư mới'],
  // --- dạng đã có parser, vẫn phải nhận là giao dịch nếu parser lỗi
  ['transaction', 'Thanh toán TRÀ TRÁI CÂY X thành công\nBạn đã thực hiện thanh toán thành công cho TRÀ TRÁI CÂY X với số tiền 15.000đ. Nhấn để kiểm tra giao dịch ngay bạn nhé.'],
  ['transaction', `Thông báo BIDV\nTài khoản thanh toán: 1440001234${SP}Số tiền GD: -546,000 VND${SP}Số dư cuối: 436,832 VND${SP}Nội dung giao dịch: SMB-TkThe :QRPACQ1ZZZZ21131974`],
  ['transaction', 'Tin biến động số dư\nThời gian: 20/10/2026 17:32\nTài khoản: 104800004982\nGiao dịch: -79,000 VND\nSố dư hiện tại: 70,758 VND\nNội dung: GD thanh toan tai Grab, the 0702'],
  ['transaction', '-48.750 đ\nTài khoản tín dụng, thẻ ••9526\nTại Grab* A-9VM6539GX97DAV 00 VN, lúc 10:11 19/10/2026'],
  ['transaction', 'SHB SAHA\nPhát sinh -10,000 VND\nTài khoản 0349000265\nNGUYEN VAN AN chuyen tien'],
  ['transaction', 'Thông báo HDBank\n18/10/2026 11:30:51 TK 0349000265(VND)\n-10,000\nSD 35\nSD KHA DUNG 35\nND NGUYEN VAN AN chuyen tien'],
  ['transaction', 'Sacombankpay: Thông báo\nNgày 20/10/2026 08:37 Cảm ơn Quý khách đã thanh toán 5,000,000 VND vào thẻ Amex Platinum Credit 3779.Số dư khả dụng: 26,381,042 VND.'],
  // --- nhắc thanh toán thẻ
  ['card_reminder', 'Thông báo HDBank\nThe 4987**5858: Tong du no: 1,219,710 VND. So tien thanh toan toi thieu 36,591 VND. QK vui long thanh toan truoc 16h30 ngay 04/11/26.'],
  ['card_reminder', 'Thông báo BIDV\nBIDV thông báo: Sao kê thẻ JCB Credit Ultimate 3565xx6385 kỳ 20/10: Dư nợ cuối kỳ 1,500,000 VND. Số tiền thanh toán tối thiểu 75,000 VND, ngày đến hạn thanh toán 04/11/2026.'],
  // --- quảng cáo, kể cả loại có số tiền / % / "điểm" / "hoàn tiền"
  ['promo', '🚨 GIỜ VÀNG GIAO DỊCH HOÀN 50% Giao dịch từ 100.000đ trên App HDBank: ✔️ Hoàn 50% tối đa 50.000đ ✔️ Tặng thêm 500.000đ cho top 10 KH'],
  ['promo', '+2.2% lãi suất khi bạn quay lại Tiếp tục kế hoạch tích lũy với mức sinh lời đến 9.6%/năm. Mở sổ ngay hôm nay!'],
  ['promo', 'Hành trình vì những bước tiến +10,000 điểm từ Chi tiêu qua Thẻ tín dụng. Đổi mảnh ghép ngay!'],
  ['promo', 'Thứ 5 vàng - Chuyển tiền quốc tế siêu dễ dàng Giảm ngay 50% phí cho giao dịch từ 250 triệu VND. Thủ tục nhanh gọn, miễn phí tư vấn!'],
  ['promo', 'SacombankPay : Ðăng ký trả góp\nThẻ Amex Platinum Credit 3779 giao dịch 5,872,362 tại cửa hàng CT TNHH HK đã đủ điều kiện trả góp. Chạm để đăng ký ngay.'],
  ['promo', 'Chi tiêu nhẹ ví, ưu đãi hết ý ✨ Chia nhỏ giao dịch lớn của bạn với trả góp ngay trên SmartBanking 🎉 Hoàn 100K cho giao dịch từ 10-20tr.'],
  ['promo', 'Thông báo HDBank Thẻ HDBank giảm đến 320.000 đồng tại Lazada!'],
  ['promo', '‼️ Cập nhật ngay ACB ONE trước 24/10/2026 Phiên bản 3.58.0 đã sẵn sàng.'],
  ['promo', 'MỘT HẠN MỨC, NHIỀU DÒNG TIỀN Rút tiền từ hạn mức thẻ tín dụng về tài khoản, lãi suất ưu đãi từ 1,25%!'],
  // --- không rõ: hiện trong hộp (nghiêng về hiện thừa)
  ['unknown', 'Tận hưởng thêm các tiện ích tài khoản Khi duy trì số dư bình quân mỗi tháng từ 2 triệu'],
]

for (const [want, text] of samples) {
  Deno.test(`classify ${want}: ${text.slice(0, 50)}`, () => {
    assertEquals(classifyUnparsed(normalizeInput(text)), want)
    // iOS gửi NFD — sau normalizeInput kết quả phải y hệt
    assertEquals(classifyUnparsed(normalizeInput(text.normalize('NFD'))), want)
  })
}
