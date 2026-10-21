// Xác thực iOS Shortcut bằng shared secret (header x-shortcut-secret).

/**
 * So sánh secret theo thời gian hằng định.
 *
 * `!==` trên chuỗi thoát ngay tại byte đầu khác nhau -> về lý thuyết là oracle đo
 * thời gian từng byte. Qua Internet thì nhiễu che gần hết tín hiệu, nhưng đây là
 * sửa vài dòng nên không có lý do giữ `!==`.
 *
 * Hash SHA-256 trước rồi XOR toàn bộ 32 byte: vòng lặp luôn chạy đủ số vòng nên
 * thời gian không phụ thuộc vị trí byte khác nhau, và độ dài secret cũng không rò
 * (mọi input đều thành 32 byte). `crypto.subtle.timingSafeEqual` KHÔNG tồn tại
 * trong Deno 2.1.4 (đã kiểm tra runtime: undefined) nên tự so sánh.
 */
export async function secretMatches(received: string | null, expected: string): Promise<boolean> {
  if (received === null) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(received)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
