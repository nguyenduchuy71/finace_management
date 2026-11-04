import { assertEquals } from 'https://deno.land/std@0.203.0/assert/mod.ts'
import { outflow, parseVND } from './helpers.ts'

Deno.test('parseVND: giữ dấu, bỏ dấu phân cách nghìn , và .', () => {
  assertEquals(parseVND('-2,007,000'), -2007000)
  assertEquals(parseVND('+499.000'), 499000)
  assertEquals(parseVND('39.000'), 39000)
})

Deno.test('outflow: số dương không dấu -> âm; đúng -parseVND', () => {
  assertEquals(outflow('500,000'), -500000)
  assertEquals(outflow('3.006.000'), -3006000)
  for (const s of ['1', '1,234', '10.005.000']) assertEquals(outflow(s), -parseVND(s))
})
