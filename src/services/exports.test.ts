import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportTransactions } from './exports'
import { supabase } from '@/lib/supabase'

// Chỉ test phần logic thuần của exports (chọn cột account_id vs card_id,
// validate tham số). Hành vi query thật đã được phủ bởi
// services.integration.test.ts chạy trên Supabase local.
// Kết quả mỗi lần gọi query: mặc định rỗng; test có thể thay để mô phỏng nhiều trang.
const mockResult = vi.hoisted(() => ({
  next: (): unknown => ({ data: [], error: null, count: 0 }),
}))

vi.mock('@/lib/supabase', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    then: (resolve: (v: unknown) => unknown) => resolve(mockResult.next()),
  }
  return { supabase: { from: vi.fn(() => builder) } }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const builderOf = () => (supabase.from as any)('transactions')

describe('exportTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.next = () => ({ data: [], error: null, count: 0 })
  })

  it('lọc theo account_id khi truyền accountId', async () => {
    await exportTransactions('acc-1')
    expect(builderOf().eq).toHaveBeenCalledWith('account_id', 'acc-1')
  })

  it('lọc theo card_id khi chỉ có cardId', async () => {
    await exportTransactions(null, { cardId: 'card-1' })
    expect(builderOf().eq).toHaveBeenCalledWith('card_id', 'card-1')
  })

  it('báo lỗi khi thiếu cả accountId lẫn cardId', async () => {
    await expect(exportTransactions(null, {})).rejects.toThrow(
      'Either accountOrCardId or filters.cardId must be provided'
    )
  })

  it('không phân trang — trả nextCursor null', async () => {
    const res = await exportTransactions('acc-1')
    expect(res.nextCursor).toBeNull()
  })

  // Trang nào cũng đầy (còn dữ liệu): trả về mảng thiếu sẽ làm CSV / hoàn tiền ước tính sai mà không ai biết.
  describe('hết trần số trang mà vẫn còn dữ liệu', () => {
    const row = (i: number) => ({
      id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      account_id: null, card_id: 'card-1', amount: -1000, description: 'x', merchant_name: 'x',
      category: null, mcc: null, status: 'posted', transaction_date: '2026-03-08T10:00:00+00:00',
    })

    it('báo lỗi thay vì trả mảng bị cắt cụt', async () => {
      // 501 dòng mỗi trang (PAGE_SIZE 500 + 1 dòng dư) => luôn còn trang sau
      mockResult.next = () => ({ data: Array.from({ length: 501 }, (_, i) => row(i)), error: null, count: 99999 })
      await expect(exportTransactions(null, { cardId: 'card-1' })).rejects.toThrow(/Quá nhiều giao dịch/)
    })

    it('đủ dữ liệu trong trần thì trả đủ, không báo lỗi', async () => {
      let call = 0
      mockResult.next = () => (call++ === 0
        ? { data: Array.from({ length: 501 }, (_, i) => row(i)), error: null, count: 503 }
        : { data: [row(900), row(901), row(902)], error: null, count: 3 })
      const res = await exportTransactions(null, { cardId: 'card-1' })
      expect(res.data).toHaveLength(503)
      expect(call).toBe(2)
    })
  })
})
