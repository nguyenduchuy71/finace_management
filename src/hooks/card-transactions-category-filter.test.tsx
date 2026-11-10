import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/services/creditCards', () => ({ getCreditCardTransactions: vi.fn() }))

import { getCreditCardTransactions } from '@/services/creditCards'
import { useFilterStore } from '@/stores/filterStore'
import { useCreditCardTransactions } from './useCreditCardTransactions'
import { useMultiCardTransactions } from './useMultiCardTransactions'

/**
 * Nút "Danh mục" hiện trên trang thẻ: chọn danh mục PHẢI đổi truy vấn (trước đây hai hook thẻ bỏ qua
 * `category` — danh sách không lọc trong khi CSV xuất lại có lọc).
 */
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  useFilterStore.getState().resetFilters()
  vi.mocked(getCreditCardTransactions).mockResolvedValue({ data: [], nextCursor: null, total: 0 })
})

describe('lọc danh mục cho giao dịch thẻ', () => {
  it.each([
    ['Từng thẻ', () => useCreditCardTransactions(), () => useFilterStore.setState({ cardId: 'c1' })],
    ['Nhiều thẻ', () => useMultiCardTransactions(), () => useFilterStore.setState({ cardIds: ['c1'] })],
  ])('%s: đổi danh mục -> gọi lại service kèm category', async (_, useHook, select) => {
    select()
    renderHook(useHook, { wrapper })
    await waitFor(() => expect(getCreditCardTransactions).toHaveBeenCalledTimes(1))

    act(() => useFilterStore.getState().setCategory('Ăn uống'))
    await waitFor(() => expect(getCreditCardTransactions).toHaveBeenCalledTimes(2))
    expect(vi.mocked(getCreditCardTransactions).mock.calls[1][3]).toMatchObject({ category: 'Ăn uống' })
  })
})
