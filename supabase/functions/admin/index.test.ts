// Cổng HTTP của function admin: không token / token sai -> 401 TRƯỚC khi chạm DB; method lạ -> 405.
// Chạy: docker run --rm -v "$PWD/supabase/functions:/f" -w /f/admin denoland/deno:2.1.4 test --allow-all
//
// index.ts gọi serve() ngay khi import (cổng 8000) nên import ĐỘNG sau khi đặt env. SUPABASE_URL trỏ
// cổng đóng: nếu code vô tình gọi GoTrue/DB thì lỗi mạng -> 500, khác 401 mà test kỳ vọng.
import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'

Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:9')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

await import('./index.ts')

const BASE = 'http://localhost:8000/'
// Server sống suốt tiến trình test: tắt sanitizer ops/resources cho các ca HTTP.
const httpTest = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, sanitizeOps: false, sanitizeResources: false, fn })

httpTest('admin index: POST không có Bearer -> 401 unauthorized, không lộ dữ liệu', async () => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'list_users' }),
  })
  assertEquals([res.status, await res.json()], [401, { error: 'unauthorized' }])
})

httpTest('admin index: Bearer sai (GoTrue không truy cập được) -> 401, không phải 500', async () => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token-gia' },
    body: JSON.stringify({ action: 'list_users' }),
  })
  assertEquals([res.status, await res.json()], [401, { error: 'unauthorized' }])
})

httpTest('admin index: GET -> 405, OPTIONS -> 204 (CORS preflight)', async () => {
  const get = await fetch(BASE, { method: 'GET' })
  assertEquals([get.status, await get.json()], [405, { error: 'method not allowed' }])
  const opt = await fetch(BASE, { method: 'OPTIONS' })
  assertEquals(opt.status, 204)
  await opt.body?.cancel()
})
