import { assert, assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { hmacSha256Hex, signatureValid, timingSafeEqualHex } from './payment-hmac.ts'

Deno.test('hmacSha256Hex: vector RFC 4231 case 2', async () => {
  assertEquals(await hmacSha256Hex('Jefe', 'what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
})

Deno.test('timingSafeEqualHex: bằng nhau / lệch 1 ký tự / độ dài khác', () => {
  const a = '5bdcc146bf60754e'
  assert(timingSafeEqualHex(a, a))
  assert(!timingSafeEqualHex(a, '5bdcc146bf60754f'))
  assert(!timingSafeEqualHex(a, a + '0'))
  assert(!timingSafeEqualHex(a, ''))
})

Deno.test('signatureValid: bỏ hoa/thường, chặn kiểu không phải chuỗi / rỗng', async () => {
  const sig = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
  assert(await signatureValid('Jefe', 'what do ya want for nothing?', sig))
  assert(await signatureValid('Jefe', 'what do ya want for nothing?', sig.toUpperCase()))
  assert(!await signatureValid('Jefe', 'what do ya want for nothing?', undefined))
  assert(!await signatureValid('Jefe', 'what do ya want for nothing?', 123))
  assert(!await signatureValid('Jefe', 'what do ya want for nothing?', ''))
  assert(!await signatureValid('Jefe', 'sửa 1 ký tự', sig))
})
