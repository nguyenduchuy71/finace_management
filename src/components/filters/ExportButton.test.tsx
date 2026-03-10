import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButton } from './ExportButton'

// Mock dependencies
vi.mock('@/stores/filterStore', () => ({
  useFilterStore: vi.fn((selector: (s: any) => any) => {
    const state = {
      accountId: 'vcb-checking-001',
      cardId: null,
      dateFrom: null,
      dateTo: null,
      searchQuery: '',
      txType: 'all' as const,
      category: 'all' as const,
    }
    return selector(state)
  }),
  useFilterParams: vi.fn(() => ({
    accountId: 'vcb-checking-001',
    dateFrom: null,
    dateTo: null,
    searchQuery: '',
    txType: 'all' as const,
    category: 'all' as const,
  })),
}))

vi.mock('@/stores/categoryOverrideStore', () => ({
  useCategoryOverrideStore: {
    getState: vi.fn(() => ({ overrides: new Map() })),
  },
}))

vi.mock('@/services/exports', () => ({
  exportTransactions: vi.fn(),
}))

vi.mock('@/utils/csv', () => ({
  formatTransactionForCSV: vi.fn(() => ({
    'Ngày': '01/03/2026',
    'Mô tả': 'Test',
    'Số tiền': '100.000 ₫',
    'Loại': 'Chi tiêu',
    'Tài khoản': 'VCB',
    'Danh mục': 'Ăn uống',
  })),
  downloadCSV: vi.fn(),
}))

vi.mock('papaparse', () => ({
  default: {
    unparse: vi.fn(() => 'csv-string'),
  },
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/hooks/useAccounts', () => ({
  useAccounts: vi.fn(() => ({
    data: {
      data: [{ id: 'vcb-checking-001', accountName: 'VCB Checking' }],
    },
  })),
}))

vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: vi.fn(() => ({
    data: {
      data: [{ id: 'tcb-visa-001', cardName: 'TCB Visa' }],
    },
  })),
}))

import { exportTransactions } from '@/services/exports'
import { downloadCSV, formatTransactionForCSV } from '@/utils/csv'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { useFilterStore, useFilterParams } from '@/stores/filterStore'

const mockExportTransactions = vi.mocked(exportTransactions)
const mockDownloadCSV = vi.mocked(downloadCSV)
const mockFormatCSV = vi.mocked(formatTransactionForCSV)
const mockUnparse = vi.mocked(Papa.unparse)
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)
const mockUseFilterStore = vi.mocked(useFilterStore)
const mockUseFilterParams = vi.mocked(useFilterParams)

beforeEach(() => {
  vi.clearAllMocks()
  mockExportTransactions.mockResolvedValue({
    data: [
      {
        id: 'tx-1',
        accountId: 'vcb-checking-001',
        amount: -50000,
        type: 'expense',
        description: 'Pho bo',
        transactionDate: '2026-03-01T10:00:00Z',
        category: 'Ăn uống',
      },
    ],
    meta: { nextCursor: null, total: 1 },
  })
})

describe('ExportButton', () => {
  it('renders as Button with Download icon and "Xuất CSV" label', () => {
    render(<ExportButton />)
    expect(screen.getByText('Xuất CSV')).toBeInTheDocument()
  })

  it('is enabled by default', () => {
    render(<ExportButton />)
    const button = screen.getByRole('button', { name: /Xuất CSV/i })
    expect(button).not.toBeDisabled()
  })

  it('shows loading state and disables button while exporting', async () => {
    // Make the export hang to test loading state
    let resolveExport!: (value: any) => void
    mockExportTransactions.mockReturnValue(
      new Promise((resolve) => { resolveExport = resolve })
    )

    render(<ExportButton />)
    const button = screen.getByRole('button', { name: /Xuất CSV/i })

    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Đang tải...')).toBeInTheDocument()
    })

    // Button should be disabled while loading
    const loadingButton = screen.getByRole('button', { name: /Đang tải/i })
    expect(loadingButton).toBeDisabled()

    // Resolve to clean up
    resolveExport({
      data: [],
      meta: { nextCursor: null, total: 0 },
    })
  })

  it('captures accountId from useFilterStore on click', async () => {
    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockExportTransactions).toHaveBeenCalledWith(
        'vcb-checking-001',
        expect.any(Object)
      )
    })
  })

  it('captures cardId when accountId is null', async () => {
    mockUseFilterStore.mockImplementation((selector: any) => {
      const state = {
        accountId: null,
        cardId: 'tcb-visa-001',
        dateFrom: null,
        dateTo: null,
        searchQuery: '',
        txType: 'all' as const,
        category: 'all' as const,
      }
      return selector(state)
    })
    mockUseFilterParams.mockReturnValue({
      accountId: null,
      dateFrom: null,
      dateTo: null,
      searchQuery: '',
      txType: 'all' as const,
      category: 'all' as const,
    })

    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockExportTransactions).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ cardId: 'tcb-visa-001' })
      )
    })
  })

  it('calls Papa.unparse on response data after formatting', async () => {
    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockFormatCSV).toHaveBeenCalled()
      expect(mockUnparse).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ header: true })
      )
    })
  })

  it('calls downloadCSV with csv string and correct filename', async () => {
    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockDownloadCSV).toHaveBeenCalledWith(
        'csv-string',
        expect.stringMatching(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/)
      )
    })
  })

  it('shows success toast after download completes', async () => {
    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Đã tải xuống CSV')
    })
  })

  it('shows error toast on failure and does not throw', async () => {
    mockExportTransactions.mockRejectedValue(new Error('Network error'))

    render(<ExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /Xuất CSV/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Tải xuống thất bại')
    })
  })

  it('returns to enabled state after success or error', async () => {
    render(<ExportButton />)
    const button = screen.getByRole('button', { name: /Xuất CSV/i })

    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Xuất CSV')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Xuất CSV/i })).not.toBeDisabled()
    })
  })
})
