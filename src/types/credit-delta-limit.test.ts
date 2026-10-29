import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_CREDIT_ADJUST } from './admin'

// Trần điều chỉnh credit có 2 bản (Deno: function `admin`, web: form) vì 2 runtime không import chung được.
// Lệch nhau = form cho nhập số mà function từ chối (hoặc ngược lại): test này đọc hằng số bên Deno và so khớp.
describe('MAX_CREDIT_ADJUST khớp MAX_CREDIT_DELTA của function admin', () => {
  it('cùng giá trị', () => {
    const src = readFileSync(resolve(__dirname, '../../supabase/functions/admin/admin-actions.ts'), 'utf8')
    const m = /const MAX_CREDIT_DELTA = ([\d_]+)/.exec(src)
    expect(m, 'không tìm thấy MAX_CREDIT_DELTA trong admin-actions.ts').not.toBeNull()
    expect(Number((m as RegExpExecArray)[1].replaceAll('_', ''))).toBe(MAX_CREDIT_ADJUST)
  })
})
