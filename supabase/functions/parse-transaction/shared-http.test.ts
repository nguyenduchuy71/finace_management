import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { bearerToken, jsonResponse, readJsonBody } from '../_shared/http.ts'

const post = (body: string) => new Request('http://x/', { method: 'POST', body })

Deno.test('readJsonBody: vượt trần -> 413 trước khi parse (kể cả JSON hợp lệ)', async () => {
  const r = await readJsonBody(post(JSON.stringify({ a: 'x'.repeat(50) })), 10)
  assertEquals(r, { ok: false, status: 413, error: 'body too large' })
})

Deno.test('readJsonBody: đúng trần OK, JSON hỏng -> 400', async () => {
  assertEquals(await readJsonBody(post('{"a":1}'), 7), { ok: true, value: { a: 1 } })
  assertEquals(await readJsonBody(post('{oops'), 100), { ok: false, status: 400, error: 'invalid json' })
})

Deno.test('jsonResponse: status, Content-Type, header phụ', async () => {
  const res = jsonResponse({ a: 1 }, 201, { 'X-T': '1' })
  assertEquals([res.status, res.headers.get('content-type'), res.headers.get('x-t')], [201, 'application/json', '1'])
  assertEquals(await res.json(), { a: 1 })
  assertEquals(jsonResponse({}, 200).headers.get('access-control-allow-origin'), null)
})

Deno.test('bearerToken: đúng một token', () => {
  const h = (v?: string) => new Headers(v ? { authorization: v } : {})
  assertEquals(bearerToken(h('Bearer abc')), 'abc')
  assertEquals(bearerToken(h('Basic abc')), null)
  assertEquals(bearerToken(h('Bearer a b')), null)
  assertEquals(bearerToken(h()), null)
})
