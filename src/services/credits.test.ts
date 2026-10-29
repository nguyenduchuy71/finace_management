import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCreditBalance, getCreditLedger, getHeldCount } from './credits'

// Builder PostgREST giả (cùng kiểu api-keys.test.ts): query thật (RLS, cột) phủ ở integration test.
const db = vi.hoisted(() => {
  const state: { data: unknown; error: unknown; count: number | null } = { data: null, error: null, count: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'limit', 'eq', 'maybeSingle']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: state.data, error: state.error, count: state.count }).then(resolve, reject)
  return { state, q, from: vi.fn(() => q) }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from } }))

beforeEach(() => {
  vi.clearAllMocks()
  db.state.data = null
  db.state.error = null
  db.state.count = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('getCreditBalance', () => {
  it('đọc balance + unlimited từ credit_balances', async () => {
    db.state.data = { balance: 42, unlimited: false }
    expect(await getCreditBalance()).toEqual({ balance: 42, unlimited: false })
    expect(db.from).toHaveBeenCalledWith('credit_balances')
    expect(db.q.select).toHaveBeenCalledWith('balance, unlimited')
  })

  it('unlimited=true được giữ nguyên', async () => {
    db.state.data = { balance: 0, unlimited: true }
    expect(await getCreditBalance()).toEqual({ balance: 0, unlimited: true })
  })

  it('chưa có dòng ví -> 0, không phải lỗi', async () => {
    db.state.data = null
    expect(await getCreditBalance()).toEqual({ balance: 0, unlimited: false })
  })

  it('lỗi DB -> ApiError an toàn (không lộ message gốc)', async () => {
    db.state.error = { code: '42501', message: 'permission denied for table credit_balances' }
    await expect(getCreditBalance()).rejects.toEqual({ code: '42501', message: 'Bạn không có quyền xem dữ liệu này.' })
  })

  it('số dư âm (dữ liệu hỏng) bị Zod chặn', async () => {
    db.state.data = { balance: -1, unlimited: false }
    await expect(getCreditBalance()).rejects.toBeTruthy()
  })
})

describe('getCreditLedger', () => {
  it('mới nhất trước, 50 dòng, chỉ cột an toàn (KHÔNG chọn ref = id giao dịch), đổi sang camelCase + ISO Z', async () => {
    db.state.data = [{ id: 7, delta: -1, kind: 'usage', created_at: '2026-10-30T10:00:00+00:00' }]
    const rows = await getCreditLedger()
    expect(db.from).toHaveBeenCalledWith('credit_ledger')
    expect(db.q.select).toHaveBeenCalledWith('id, delta, kind, created_at')
    expect(db.q.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(db.q.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(db.q.limit).toHaveBeenCalledWith(50)
    expect(rows).toEqual([{ id: 7, delta: -1, kind: 'usage', createdAt: '2026-10-30T10:00:00.000Z' }])
  })

  it('kind lạ (DB đổi hợp đồng) -> lỗi, không hiển thị bừa', async () => {
    db.state.data = [{ id: 1, delta: 5, kind: 'free', created_at: '2026-10-30T10:00:00+00:00' }]
    await expect(getCreditLedger()).rejects.toBeTruthy()
  })
})

describe('getHeldCount', () => {
  it('đếm tin reason=no_credit chưa resolved', async () => {
    db.state.count = 3
    expect(await getHeldCount()).toBe(3)
    expect(db.from).toHaveBeenCalledWith('unparsed_messages')
    expect(db.q.eq).toHaveBeenCalledWith('reason', 'no_credit')
    expect(db.q.eq).toHaveBeenCalledWith('resolved', false)
  })
})
