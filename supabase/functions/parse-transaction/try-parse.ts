// Thử 1 đoạn thông báo với TẤT CẢ parser, in ra kết quả — chạy LOCAL, không cần deploy.
//
// Dùng để kiểm tra nhanh khi viết parser mới cho bank chưa hỗ trợ:
//
//   docker run --rm --entrypoint deno -v "$PWD:/app" -w /app denoland/deno:2.1.4 \
//     run --allow-all try-parse.ts "07/09/2026|15:08|Tài khoản:0349360265|..."
//
// Hoặc đọc từ stdin (tiện khi text có ký tự đặc biệt):
//   echo '<noi dung thong bao>' | docker run --rm -i --entrypoint deno \
//     -v "$PWD:/app" -w /app denoland/deno:2.1.4 run --allow-all try-parse.ts

import { parsers } from './parsers.ts'
import { normalizeInput } from './helpers.ts'

const arg = Deno.args.join(' ').trim()
// Chuẩn hoá NFC giống edge function — text dán từ iOS thường là NFD.
const text = normalizeInput(arg || new TextDecoder().decode(
  await new Response(Deno.stdin.readable).arrayBuffer(),
))

if (!text) {
  console.error('Cần truyền nội dung thông báo qua tham số hoặc stdin.')
  Deno.exit(1)
}

console.log(`\nInput (${text.length} ký tự):\n  ${text}\n`)

// Cùng thứ tự kiểm tra như edge function để kết quả khớp production
if (/OTP|Ma xac thuc|xac thuc OTP|OTP for/i.test(text)) {
  console.log('=> BỎ QUA: nhận diện là tin OTP/bảo mật, không phải giao dịch.')
  Deno.exit(0)
}

for (const parser of parsers) {
  const r = parser(text)
  if (!r) continue

  console.log(`=> KHỚP parser: ${r.bank_name}`)
  console.table({
    bank_name: r.bank_name,
    amount: r.amount,
    'amount hợp lệ': Number.isFinite(r.amount) ? 'OK' : 'LỖI (NaN)',
    transaction_date: r.transaction_date,
    'ngày hợp lệ': Number.isNaN(Date.parse(r.transaction_date)) ? 'LỖI' : 'OK',
    source_type: r.source_type,
    account_ref: r.account_ref ?? '(null)',
    merchant_name: r.merchant_name ?? '(null)',
    description: r.description,
  })

  console.log(
    `\nKiểm tra tiếp: account_ref='${r.account_ref}' phải khớp 4 ký tự cuối của\n` +
    `  ${r.source_type === 'bank' ? 'accounts.account_number' : 'credit_cards.card_number'}\n` +
    `trong DB, nếu không giao dịch sẽ KHÔNG hiện trong danh sách.`,
  )
  Deno.exit(0)
}

console.log('=> KHÔNG parser nào khớp.')
console.log('   Trên production, thông báo này sẽ được lưu vào `unparsed_messages`.')
console.log('   Cần viết parser mới trong parsers.ts (xem hướng dẫn ở cuối file đó).')
