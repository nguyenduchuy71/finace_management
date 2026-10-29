import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Builder PostgREST giả + functions.invoke giả (query thật phủ ở payments.integration.test.ts).
const db = vi.hoisted(() => {
  const state: { data: unknown; error: unknown } = { data: null, error: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'limit', 'eq', 'maybeSingle']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject)
  return { state, q, from: vi.fn(() => q), invoke: vi.fn() }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from, functions: { invoke: db.invoke } } }))

import { createPayment, getOrder, getProviders, listOrders, listPackages, refreshOrder } from './payments'

const ORDER = '00000000-0000-4000-8000-000000000001'
const ok = (data: unknown) => ({ data, error: null })
const httpError = (status: number, body: unknown) => ({
  data: null,
  error: Object.assign(new Error('non-2xx'), { name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }) }),
})

beforeEach(() => {
  vi.clearAllMocks()
  db.state.data = null
  db.state.error = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('đọc gói + đơn (RLS)', () => {
  it('listPackages: chọn đúng cột, sắp theo sort, bigint dạng chuỗi -> số', async () => {
    db.state.data = [{ id: 'p50k', credits: 500, price_vnd: '50000' }]
    expect(await listPackages()).toEqual([{ id: 'p50k', credits: 500, priceVnd: 50000 }])
    expect(db.from).toHaveBeenCalledWith('credit_packages')
    expect(db.q.select).toHaveBeenCalledWith('id, credits, price_vnd')
    expect(db.q.order).toHaveBeenCalledWith('sort')
  })

  it('listOrders: không select(*), giới hạn 20, chuẩn hoá timestamptz', async () => {
    db.state.data = [{ id: ORDER, provider: 'momo', status: 'paid', amount_vnd: 50000, credits: 500, created_at: '2026-10-31T03:00:00+00:00' }]
    const orders = await listOrders()
    expect(orders[0]).toMatchObject({ id: ORDER, provider: 'momo', status: 'paid', amountVnd: 50000, createdAt: '2026-10-31T03:00:00.000Z' })
    expect(db.q.select).toHaveBeenCalledWith('id, provider, status, amount_vnd, credits, created_at')
    expect(db.q.limit).toHaveBeenCalledWith(20)
  })

  it('đơn có provider/status lạ (DB sai) -> Zod chặn, không render rác', async () => {
    db.state.data = [{ id: ORDER, provider: 'paypal', status: 'paid', amount_vnd: 1, credits: 1, created_at: '2026-10-31T03:00:00Z' }]
    await expect(listOrders()).rejects.toThrow()
  })

  it('getOrder: không thấy -> null; lỗi DB -> ApiError an toàn', async () => {
    db.state.data = null
    expect(await getOrder(ORDER)).toBeNull()
    db.state.error = { code: '42501', message: 'chi tiết nội bộ' }
    await expect(getOrder(ORDER)).rejects.toMatchObject({ code: '42501' })
  })
})

describe('function create-payment', () => {
  it('getProviders: GET, trả ví đang bật', async () => {
    db.invoke.mockResolvedValue(ok({ providers: ['momo'] }))
    expect(await getProviders()).toEqual(['momo'])
    expect(db.invoke).toHaveBeenCalledWith('create-payment', { method: 'GET' })
  })

  it('createPayment: gửi action/provider/package_id, KHÔNG gửi user_id hay URL', async () => {
    db.invoke.mockResolvedValue(ok({ order_id: ORDER, pay_url: 'https://test-payment.momo.vn/pay/1' }))
    expect(await createPayment('momo', 'p50k')).toEqual({ orderId: ORDER, payUrl: 'https://test-payment.momo.vn/pay/1' })
    expect(db.invoke).toHaveBeenCalledWith('create-payment', { method: 'POST', body: { action: 'create', provider: 'momo', package_id: 'p50k' } })
  })

  it('từ chối pay_url không phải https (không điều hướng tới javascript:/http:)', async () => {
    for (const pay_url of ['http://x.example/pay', 'javascript:alert(1)']) {
      db.invoke.mockResolvedValue(ok({ order_id: ORDER, pay_url }))
      await expect(createPayment('momo', 'p50k')).rejects.toMatchObject({ code: 'invalid_response' })
    }
  })

  it('mã lỗi của function -> thông điệp tiếng Việt, không lộ mã thô', async () => {
    db.invoke.mockResolvedValue(httpError(503, { error: 'provider_disabled' }))
    await expect(createPayment('momo', 'p50k')).rejects.toMatchObject({ code: 'provider_disabled', message: expect.stringContaining('chưa mở') })
    db.invoke.mockResolvedValue(httpError(429, { error: 'too_many_pending' }))
    await expect(createPayment('momo', 'p50k')).rejects.toMatchObject({ code: 'too_many_pending' })
    db.invoke.mockResolvedValue(httpError(502, 'html'))
    await expect(createPayment('momo', 'p50k')).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('mất mạng (invoke throw) -> ApiError', async () => {
    db.invoke.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getProviders()).rejects.toMatchObject({ code: 'internal_error' })
  })

  it('refreshOrder: trả status của đơn', async () => {
    db.invoke.mockResolvedValue(ok({ status: 'paid' }))
    expect(await refreshOrder(ORDER)).toBe('paid')
    expect(db.invoke).toHaveBeenCalledWith('create-payment', { method: 'POST', body: { action: 'refresh', order_id: ORDER } })
  })
})
