// HMAC-SHA256 + so sánh chữ ký thời gian hằng định cho MoMo / ZaloPay (chỉ Web Crypto).

const enc = new TextEncoder()

/** HMAC-SHA256(key, message) -> hex thường (cả MoMo lẫn ZaloPay đều dùng dạng này). */
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * So 2 chuỗi hex: XOR TOÀN BỘ byte (không thoát sớm ở byte khác đầu tiên). Độ dài khác -> false:
 * độ dài chữ ký hợp lệ là công khai (64 ký tự) nên lộ độ dài không rò gì. Không dùng `!==`.
 * (`crypto.subtle.timingSafeEqual` không có trong Deno 2.1.4 — xem parse-transaction/shortcut-auth.ts.)
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Chữ ký nhận được (bỏ hoa/thường) có khớp HMAC tính lại từ `message` không. */
export async function signatureValid(key: string, message: string, received: unknown): Promise<boolean> {
  if (typeof received !== 'string' || received === '') return false
  return timingSafeEqualHex(await hmacSha256Hex(key, message), received.toLowerCase())
}
