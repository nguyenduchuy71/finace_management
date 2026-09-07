import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportTransactions } from './exports'
import { supabase } from '@/lib/supabase'

// Chỉ test phần logic thuần của exports (chọn cột account_id vs card_id,
// validate tham số). Hành vi query thật đã được phủ bởi
// services.integration.test.ts chạy trên Supabase local.
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
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null, count: 0 }),
  }
  return { supabase: { from: vi.fn(() => builder) } }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const builderOf = () => (supabase.from as any)('transactions')

describe('exportTransactions', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
