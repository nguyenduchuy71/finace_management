import { describe, it, expect } from 'vitest'
import { applyTransactionFilters, countOption, paginate, totalForPage, toTxQueryOptions } from './transactionQuery'
import { encodeCursor } from './query-cursor'

type Call = [method: string, ...args: unknown[]]

/** Query builder giả: ghi lại mọi lời gọi (theo thứ tự) và trả chính nó như PostgREST. */
function recordingBuilder() {
  const calls: Call[] = []
  const proxy: unknown = new Proxy({}, {
    get: (_t, method: string) => (...args: unknown[]) => {
      calls.push([method, ...args])
      return proxy
    },
  })
  return { q: proxy as Parameters<typeof applyTransactionFilters>[0], calls }
}

const apply = (cursor?: string, limit = 20, filters?: Parameters<typeof applyTransactionFilters>[3]) => {
  const { q, calls } = recordingBuilder()
  applyTransactionFilters(q, cursor, limit, filters)
  return calls
}
const methods = (calls: Call[]) => calls.map((c) => c[0])

const ID = '123e4567-e89b-42d3-a456-426614174000'
const DATE = '2026-03-08T10:00:00+00:00'

describe('applyTransactionFilters', () => {
  it('luôn sắp xếp (date, id) giảm dần và lấy dư 1 dòng', () => {
    expect(apply(undefined, 20)).toEqual([
      ['order', 'transaction_date', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 21],
    ])
  })

  it('cursor hợp lệ -> điều kiện keyset (date, id) < cursor', () => {
    const calls = apply(encodeCursor({ transaction_date: DATE, id: ID }))
    expect(calls).toContainEqual([
      'or',
      `transaction_date.lt.${DATE},and(transaction_date.eq.${DATE},id.lt.${ID})`,
    ])
  })

  it('cursor hỏng / bị chèn filter -> bỏ keyset, không phát or()', () => {
    expect(methods(apply('không-phải-base64!'))).not.toContain('or')
    const injected = btoa(`2020-01-01,id.not.is.null|${ID}`)
    expect(methods(apply(injected))).not.toContain('or')
  })

  it('search được làm sạch ký tự phá cú pháp .or()', () => {
    const calls = apply(undefined, 20, { search: 'a,b(c)%_"x"' })
    const or = calls.find((c) => c[0] === 'or')
    expect(or).toEqual(['or', 'description.ilike.%a b c x%,merchant_name.ilike.%a b c x%'])
  })

  it('search chỉ gồm ký tự bị loại -> không phát or()', () => {
    expect(methods(apply(undefined, 20, { search: ' ,() ' }))).not.toContain('or')
  })

  it('dateFrom / dateTo / dateBefore -> gte / lte / lt trên transaction_date', () => {
    const calls = apply(undefined, 20, { dateFrom: 'A', dateTo: 'B', dateBefore: 'C' })
    expect(calls).toContainEqual(['gte', 'transaction_date', 'A'])
    expect(calls).toContainEqual(['lte', 'transaction_date', 'B'])
    expect(calls).toContainEqual(['lt', 'transaction_date', 'C'])
  })

  it('txType income -> amount > 0, expense -> amount < 0, all -> không lọc', () => {
    expect(apply(undefined, 20, { txType: 'income' })).toContainEqual(['gt', 'amount', 0])
    expect(apply(undefined, 20, { txType: 'expense' })).toContainEqual(['lt', 'amount', 0])
    expect(methods(apply(undefined, 20, { txType: 'all' }))).toEqual(['order', 'order', 'limit'])
  })

  it('category cụ thể -> eq; "all" hoặc vắng -> không lọc', () => {
    expect(apply(undefined, 20, { category: 'Ăn uống' })).toContainEqual(['eq', 'category', 'Ăn uống'])
    expect(methods(apply(undefined, 20, { category: 'all' }))).not.toContain('eq')
    expect(methods(apply(undefined, 20, {}))).not.toContain('eq')
  })

  it('dateTo vắng/null không phát lte', () => {
    expect(methods(apply(undefined, 20, { dateFrom: null, dateTo: null, dateBefore: null }))).toEqual(['order', 'order', 'limit'])
  })
})

describe('helper phân trang', () => {
  it('countOption chỉ đếm ở trang đầu; totalForPage trả 0 từ trang 2', () => {
    expect(countOption(undefined)).toEqual({ count: 'exact' })
    expect(countOption('c')).toEqual({})
    expect(totalForPage(7, undefined)).toBe(7)
    expect(totalForPage(null, undefined)).toBe(0)
    expect(totalForPage(7, 'c')).toBe(0)
  })

  it('paginate cắt dòng dư và báo hasMore', () => {
    const rows = [1, 2, 3].map((n) => ({ id: String(n), transaction_date: DATE }))
    expect(paginate(rows, 2)).toEqual({ rows: rows.slice(0, 2), hasMore: true })
    expect(paginate(rows, 3)).toEqual({ rows, hasMore: false })
  })

  it('toTxQueryOptions: search rỗng thành undefined', () => {
    expect(toTxQueryOptions({ searchQuery: '', dateFrom: null, dateTo: null, txType: 'all' }).search).toBeUndefined()
  })
})
