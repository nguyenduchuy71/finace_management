import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportTransactions } from './exports'
import { apiClient } from './apiClient'
import type { Transaction } from '@/types/account'
import type { TransactionFilters } from './accounts'

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockTransaction: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  amount: -150000,
  description: 'Lunch',
  merchantName: 'Restaurant',
  category: 'Ăn uống',
  type: 'expense',
  status: 'posted',
  transactionDate: '2026-03-09T10:00:00Z',
}

const mockPaginatedResponse = {
  data: [mockTransaction],
  nextCursor: null,
  total: 1,
}

describe('Export Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls apiClient.get with correct bank account endpoint', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockPaginatedResponse,
    })

    await exportTransactions('acc-1')

    expect(getSpy).toHaveBeenCalledWith('/accounts/acc-1/transactions', {
      params: {},
    })
  })

  it('passes dateFrom, dateTo, txType, category, search in params', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockPaginatedResponse,
    })

    const filters: TransactionFilters = {
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      txType: 'expense',
      category: 'Ăn uống',
      search: 'restaurant',
    }

    await exportTransactions('acc-1', filters)

    expect(getSpy).toHaveBeenCalledWith('/accounts/acc-1/transactions', {
      params: {
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
        txType: 'expense',
        category: 'Ăn uống',
        search: 'restaurant',
      },
    })
  })

  it('does NOT include pagination params (no cursor, no limit)', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockPaginatedResponse,
    })

    await exportTransactions('acc-1', { search: 'test' })

    const callParams = getSpy.mock.calls[0][1]?.params
    expect(callParams).not.toHaveProperty('cursor')
    expect(callParams).not.toHaveProperty('limit')
  })

  it('returns parsed PaginatedResponse', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockPaginatedResponse,
    })

    const result = await exportTransactions('acc-1')

    expect(result.data).toEqual([mockTransaction])
    expect(result.total).toBe(1)
  })

  it('validates response via Zod schema', async () => {
    const invalidResponse = {
      data: [{ id: 'tx-1', accountId: 'acc-1' }],
      nextCursor: null,
      total: 1,
    }

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: invalidResponse,
    })

    await expect(exportTransactions('acc-1')).rejects.toThrow()
  })

  it('omits undefined or "all" filter values', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: mockPaginatedResponse,
    })

    const filters: TransactionFilters = {
      txType: 'all',
      category: 'all',
    }

    await exportTransactions('acc-1', filters)

    const callParams = getSpy.mock.calls[0][1]?.params
    expect(callParams).not.toHaveProperty('txType')
    expect(callParams).not.toHaveProperty('category')
  })
})
