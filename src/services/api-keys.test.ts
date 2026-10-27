import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listApiKeys, createApiKey, revokeApiKey } from './api-keys'

// Builder PostgREST giả: mọi hàm chain trả về chính nó; `await` ra { data, error } trong `state`.
// Query thật (RLS, cột, trigger) đã phủ ở integration test — ở đây chỉ kiểm lời gọi và mapping.
const db = vi.hoisted(() => {
  const state: { data: unknown; error: unknown } = { data: null, error: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'update', 'eq', 'is']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject)
  return { state, q, from: vi.fn(() => q), rpc: vi.fn() }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from, rpc: db.rpc } }))

const ROW = {
  id: 'k1',
  name: 'iPhone',
  prefix: 'vj_abc123',
  last4: 'Wxyz',
  created_at: '2026-10-01T10:00:00+00:00',
  last_used_at: null,
  revoked_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  db.rpc.mockReset()
  db.state.data = null
  db.state.error = null
  // toApiError ghi console.error — tắt để log test sạch.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listApiKeys', () => {
  it('chỉ select đúng các cột được cấp quyền, KHÔNG dùng "*" (key_hash bị revoke với authenticated)', async () => {
    db.state.data = [ROW]
    await listApiKeys()
    expect(db.from).toHaveBeenCalledWith('api_keys')
    expect(db.q.select).toHaveBeenCalledWith('id, name, prefix, last4, created_at, last_used_at, revoked_at')
    expect(db.q.select).not.toHaveBeenCalledWith('*')
  })

  it('sắp xếp key còn hiệu lực trước (revoked_at NULL đứng đầu), rồi mới nhất trước', async () => {
    db.state.data = []
    await listApiKeys()
    expect(db.q.order).toHaveBeenNthCalledWith(1, 'revoked_at', { ascending: false, nullsFirst: true })
    expect(db.q.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
  })

  it('map snake_case sang camelCase và chuẩn hoá thời gian về ISO UTC', async () => {
    db.state.data = [
      ROW,
      {
        ...ROW,
        id: 'k2',
        last_used_at: '2026-10-02T08:30:00+07:00',
        revoked_at: '2026-10-03T00:00:00+00:00',
      },
    ]
    const keys = await listApiKeys()
    expect(keys).toEqual([
      {
        id: 'k1', name: 'iPhone', prefix: 'vj_abc123', last4: 'Wxyz',
        createdAt: '2026-10-01T10:00:00.000Z', lastUsedAt: null, revokedAt: null,
      },
      {
        id: 'k2', name: 'iPhone', prefix: 'vj_abc123', last4: 'Wxyz',
        createdAt: '2026-10-01T10:00:00.000Z',
        lastUsedAt: '2026-10-02T01:30:00.000Z',
        revokedAt: '2026-10-03T00:00:00.000Z',
      },
    ])
  })

  it('trả mảng rỗng khi chưa có key', async () => {
    db.state.data = []
    await expect(listApiKeys()).resolves.toEqual([])
  })

  it('lỗi PostgREST -> ApiError có thông điệp an toàn (không lộ message gốc)', async () => {
    db.state.error = { code: '42501', message: 'permission denied for column key_hash', details: '' }
    await expect(listApiKeys()).rejects.toEqual({
      code: '42501',
      message: 'Bạn không có quyền xem dữ liệu này.',
    })
  })
})

describe('createApiKey', () => {
  it('gọi RPC create_api_key với p_name và trả về key đầy đủ', async () => {
    db.rpc.mockResolvedValueOnce({ data: 'vj_live_full_secret_value', error: null })
    await expect(createApiKey('iPhone')).resolves.toBe('vj_live_full_secret_value')
    expect(db.rpc).toHaveBeenCalledWith('create_api_key', { p_name: 'iPhone' })
  })

  it('lỗi 22023 (tên sai độ dài hoặc quá 10 key) -> thông điệp riêng của tạo key', async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'limit', details: '' } })
    await expect(createApiKey('x')).rejects.toEqual({
      code: '22023',
      message: 'Không tạo được key: tên phải 1–50 ký tự và tối đa 10 key còn hiệu lực.',
    })
  })

  it('lỗi mã khác -> thông điệp chung an toàn', async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'internal', details: '' } })
    await expect(createApiKey('iPhone')).rejects.toEqual({
      code: 'XX000',
      message: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    })
  })
})

describe('revokeApiKey', () => {
  it('update revoked_at = thời điểm hiện tại (ISO), lọc đúng id và chỉ key chưa thu hồi', async () => {
    await revokeApiKey('k1')
    expect(db.from).toHaveBeenCalledWith('api_keys')
    expect(db.q.update).toHaveBeenCalledWith({ revoked_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) })
    expect(db.q.eq).toHaveBeenCalledWith('id', 'k1')
    expect(db.q.is).toHaveBeenCalledWith('revoked_at', null)
  })

  it('22023 (trigger chặn sửa key đã thu hồi) -> thông điệp của thu hồi, không phải của tạo key', async () => {
    db.state.error = { code: '22023', message: 'api key đã thu hồi', details: '' }
    await expect(revokeApiKey('k1')).rejects.toEqual({ code: '22023', message: 'Key này đã bị thu hồi trước đó.' })
  })

  it('lỗi DB -> ném ApiError', async () => {
    db.state.error = { code: '42501', message: 'denied', details: '' }
    await expect(revokeApiKey('k1')).rejects.toEqual({
      code: '42501',
      message: 'Bạn không có quyền xem dữ liệu này.',
    })
  })
})
