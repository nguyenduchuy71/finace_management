import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/creditCards', () => ({ updateCardTransactionMcc: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { toast } from 'sonner'
import { updateCardTransactionMcc } from '@/services/creditCards'
import { useUpdateTransactionMcc } from './useUpdateTransactionMcc'
import type { PaginatedResponse } from '@/types/api'
import type { CreditCardTransaction } from '@/types/creditCard'

type Pages = InfiniteData<PaginatedResponse<CreditCardTransaction>>

const tx = (id: string, mcc?: string): CreditCardTransaction => ({
  id, cardId: 'c1', amount: -1000, description: id, merchantName: id,
  type: 'purchase', status: 'posted', transactionDate: '2026-03-08T10:00:00Z', mcc,
})

const KEY_A = ['creditCardTransactions', 'c1', { searchQuery: '' }]
const KEY_B = ['creditCardTransactions', 'c1', { searchQuery: 'grab' }]

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const seed = (): Pages => ({
    pageParams: [undefined, 'cursor-2'],
    pages: [
      { data: [tx('a'), tx('b', '5411')], nextCursor: 'cursor-2', total: 4 },
      { data: [tx('c'), tx('d')], nextCursor: null, total: 4 },
    ],
  })
  client.setQueryData(KEY_A, seed())
  client.setQueryData(KEY_B, seed())
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(() => useUpdateTransactionMcc(), { wrapper })
  const mccOf = (key: unknown[], id: string) =>
    client.getQueryData<Pages>(key)!.pages.flatMap((p) => p.data).find((t) => t.id === id)!.mcc
  return { client, result, mccOf }
}

beforeEach(() => vi.resetAllMocks())

describe('useUpdateTransactionMcc', () => {
  it('cập nhật NGAY (trước khi server trả lời) ở mọi trang và mọi bộ lọc đang cache', async () => {
    let resolve!: () => void
    vi.mocked(updateCardTransactionMcc).mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { result, mccOf } = setup()

    act(() => { result.current.mutate({ txId: 'c', mcc: '5812' }) })
    await waitFor(() => expect(mccOf(KEY_A, 'c')).toBe('5812')) // trang 2
    expect(mccOf(KEY_B, 'c')).toBe('5812') // bộ lọc khác
    expect(mccOf(KEY_A, 'a')).toBeUndefined() // dòng khác không bị đụng
    expect(mccOf(KEY_A, 'b')).toBe('5411')

    resolve()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updateCardTransactionMcc).toHaveBeenCalledWith('c', '5812')
  })

  it('bỏ phân loại (null) xoá mcc trong cache', async () => {
    vi.mocked(updateCardTransactionMcc).mockResolvedValue()
    const { result, mccOf } = setup()
    await act(() => result.current.mutateAsync({ txId: 'b', mcc: null }))
    expect(mccOf(KEY_A, 'b')).toBeUndefined()
  })

  it('lỗi: hoàn tác về giá trị cũ ở mọi cache và báo toast', async () => {
    vi.mocked(updateCardTransactionMcc).mockRejectedValue({ code: 'NOT_FOUND', message: 'Không tìm thấy giao dịch.' })
    const { result, mccOf } = setup()

    await act(async () => { await result.current.mutateAsync({ txId: 'b', mcc: '4121' }).catch(() => {}) })

    expect(mccOf(KEY_A, 'b')).toBe('5411')
    expect(mccOf(KEY_B, 'b')).toBe('5411')
    expect(toast.error).toHaveBeenCalledWith('Không tìm thấy giao dịch.')
  })

  it('xong (thành công hay lỗi) đều invalidate để đồng bộ với server', async () => {
    vi.mocked(updateCardTransactionMcc).mockResolvedValue()
    const { client, result } = setup()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await act(() => result.current.mutateAsync({ txId: 'a', mcc: '5411' }))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['creditCardTransactions'] })
  })

  // Trước đây rollback khôi phục cả ảnh chụp cache nên xoá luôn thay đổi lạc quan của sửa khác.
  it('lỗi của lần sửa A KHÔNG xoá thay đổi lạc quan của lần sửa B đang chạy song song', async () => {
    let rejectA!: (e: unknown) => void
    let resolveB!: () => void
    vi.mocked(updateCardTransactionMcc).mockImplementation((id: string) =>
      id === 'a'
        ? new Promise<void>((_, rej) => { rejectA = rej })
        : new Promise<void>((res) => { resolveB = res })
    )
    const { result, mccOf } = setup()

    act(() => { result.current.mutate({ txId: 'a', mcc: '4121' }) })
    await waitFor(() => expect(mccOf(KEY_A, 'a')).toBe('4121'))
    act(() => { result.current.mutate({ txId: 'c', mcc: '5812' }) })
    await waitFor(() => expect(mccOf(KEY_A, 'c')).toBe('5812'))

    await act(async () => { rejectA({ code: 'X', message: 'lỗi A' }) })

    expect(mccOf(KEY_A, 'a')).toBeUndefined() // A được hoàn tác
    expect(mccOf(KEY_A, 'c')).toBe('5812')    // B vẫn giữ giá trị lạc quan
    resolveB()
  })

  // Trả về promise từ onSettled giữ mutation ở isPending cho tới khi refetch xong MỌI trang đã tải.
  it('lưu xong là xong: không bị giữ isPending để chờ refetch cả danh sách', async () => {
    vi.mocked(updateCardTransactionMcc).mockResolvedValue()
    const { client, result } = setup()
    vi.spyOn(client, 'invalidateQueries').mockReturnValue(new Promise(() => {})) // refetch không bao giờ xong

    await act(async () => { await result.current.mutateAsync({ txId: 'a', mcc: '5411' }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isPending).toBe(false)
  })
})
