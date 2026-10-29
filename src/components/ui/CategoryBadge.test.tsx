import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { CategoryBadge } from './CategoryBadge'
import { CATEGORIES } from '@/types/categories'

const css = readFileSync('src/index.css', 'utf8')

type Oklch = [number, number, number]

/** Lấy giá trị oklch của token trong khối `:root {` hoặc `.dark {` của index.css. */
function token(block: ':root' | '.dark', name: string): Oklch {
  const start = css.indexOf(`\n${block} {`)
  const m = css.slice(start).match(new RegExp(`--${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`))
  if (!m) throw new Error(`thiếu token --${name} trong ${block}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function luminance([L, C, h]: Oklch): number {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const ch = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)))
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('CategoryBadge', () => {
  it.each(CATEGORIES.map((c, i) => [c, i + 1] as const))('%s dùng token ngữ nghĩa cat-%i', (category, n) => {
    render(<CategoryBadge category={category} />)
    const badge = screen.getByText(category)
    expect(badge).toHaveClass(`bg-cat-${n}-soft`, `text-cat-${n}`)
    expect(badge.className).not.toMatch(/\b(?:bg|text)-(?:orange|pink|blue|purple|amber|slate|green|red|emerald|rose)-/)
  })

  it('nhận className bổ sung', () => {
    render(<CategoryBadge category="Khác" className="extra" />)
    expect(screen.getByText('Khác')).toHaveClass('extra')
  })

  // WCAG AA: chữ thường cần >= 4.5:1, đo ở cả hai theme (đổi oklch phải đo lại).
  describe.each([':root', '.dark'] as const)('tương phản chữ/nền ở %s', (block) => {
    it.each([1, 2, 3, 4, 5, 6])('cat-%i >= 4.5:1', (n) => {
      expect(contrast(token(block, `cat-${n}`), token(block, `cat-${n}-soft`))).toBeGreaterThanOrEqual(4.5)
    })
  })
})
