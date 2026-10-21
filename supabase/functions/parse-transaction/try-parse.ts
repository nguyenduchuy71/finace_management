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

import { isOtp, parseNotification } from './ingest.ts'
import { parseOwnerNames } from './internal-transfer.ts'
import { classifyUnparsed } from './classify-unparsed.ts'
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

// Cùng logic với edge function (ingest.ts) để kết quả khớp production.
// OWNER_NAMES lấy từ env nếu có (nhận diện chuyển nội bộ).
if (isOtp(text)) {
  console.log('=> BỎ QUA: nhận diện là tin OTP/bảo mật, không phải giao dịch.')
  Deno.exit(0)
}

const outcome = parseNotification(text, parseOwnerNames(Deno.env.get('OWNER_NAMES')))
if (outcome.status === 'invalid') {
  console.log(`=> KHỚP parser ${outcome.bank} nhưng ra dữ liệu hỏng (NaN/0 số tiền hoặc ngày) -> invalid_parse`)
  Deno.exit(0)
}
if (outcome.status === 'no_match') {
  console.log(`=> KHÔNG parser nào khớp. Gợi ý loại cho hộp tin: ${classifyUnparsed(text)}`)
  Deno.exit(0)
}

const r = outcome.tx
console.log(`=> KHỚP parser: ${r.bank_name}`)
console.table({
  bank_name: r.bank_name,
  amount: r.amount,
  transaction_date: r.transaction_date,
  source_type: r.source_type,
  account_ref: r.account_ref ?? '(null)',
  merchant_name: r.merchant_name ?? '(null)',
  kind: r.kind,
  description: r.description,
})
console.log(
  `\nKiểm tra tiếp: account_ref='${r.account_ref}' phải khớp 4 ký tự cuối của DUY NHẤT một\n` +
  `  ${r.source_type === 'bank' ? 'accounts.account_number' : 'credit_cards.card_number'} (bank_name='${r.bank_name}')\n` +
  `trong DB, nếu không tin sẽ vào hộp "Chưa phân loại" (reason no_account) thay vì thành giao dịch.`,
)
