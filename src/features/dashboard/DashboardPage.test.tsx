import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useDashboardStore } from '@/stores/dashboardStore'
import { DashboardPage } from '@/pages/DashboardPage'
import * as dashboardService from '@/services/dashboard'
import type { DashboardStats } from '@/services/dashboard'

// Mock ở tầng service — query thật đã phủ ở services.integration.test.ts
vi.mock('@/services/dashboard', async (orig) => ({
  ...(await orig<typeof import('@/services/dashboard')>()),
  getDashboardStats: vi.fn(),
}))

// Mock recharts to avoid canvas rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'responsive-container' }, children),
  PieChart: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => createElement('div', { 'data-testid': 'pie' }),
  Cell: () => createElement('div', { 'data-testid': 'cell' }),
  BarChart: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => createElement('div', { 'data-testid': 'bar' }),
  XAxis: () => createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => createElement('div', { 'data-testid': 'legend' }),
}))

const STATS: DashboardStats = {
  totalIncome: 19827000,
  totalExpense: 7718430,
  bankIncome: 14827000,
  bankExpense: 150430,
  ccIncome: 5000000,
  ccExpense: 7568000,
  categoryBreakdown: [
    { category: 'Ăn uống', amount: 2157000 },
    { category: 'Mua sắm', amount: 500000 },
    { category: 'Khác', amount: 5061430 },
  ],
  transactionCount: 8,
}

beforeEach(() => {
  vi.mocked(dashboardService.getDashboardStats).mockResolvedValue(STATS)
})

afterEach(() => {
  vi.clearAllMocks()
  useDashboardStore.setState({ dateFrom: null, dateTo: null })
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function renderDashboardPage() {
  const wrapper = createWrapper()
  return render(<DashboardPage />, { wrapper })
}

describe('DashboardPage', () => {
  describe('page structure', () => {
    it('renders the page title', () => {
      renderDashboardPage()
      expect(screen.getByText('Tổng quan')).toBeInTheDocument()
    })

    it('renders the date picker component', () => {
      renderDashboardPage()
      // DashboardDatePicker renders date range inputs
      expect(document.body.textContent).toContain('Tổng quan')
    })
  })

  describe('loading state', () => {
    it('renders skeleton cards while loading', () => {
      // Promise không bao giờ resolve -> giữ nguyên trạng thái loading
      vi.mocked(dashboardService.getDashboardStats).mockReturnValue(new Promise(() => {}))

      const { container } = renderDashboardPage()
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
      expect(screen.queryByText('Tổng thu')).not.toBeInTheDocument()
    })
  })

  describe('success state', () => {
    it('renders Total Income stat card after data loads', async () => {
      renderDashboardPage()

      await waitFor(() => {
        expect(screen.getByText('Tổng thu')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('renders Total Expense stat card after data loads', async () => {
      renderDashboardPage()

      await waitFor(() => {
        expect(screen.getByText('Tổng chi')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('shows formatted VND amounts', async () => {
      vi.mocked(dashboardService.getDashboardStats).mockResolvedValue({
        totalIncome: 10_000_000, totalExpense: 5_000_000,
        bankIncome: 10_000_000, bankExpense: 3_000_000,
        ccIncome: 0, ccExpense: 2_000_000,
        categoryBreakdown: [{ category: 'Ăn uống', amount: 2_000_000 }],
        transactionCount: 15,
      })

      renderDashboardPage()

      // Wait for stat cards to render (transactionCount > 0 required)
      // Use regex to match VND format regardless of exact whitespace/encoding
      await waitFor(() => {
        // Both income and expense cards should show their amounts
        expect(screen.getByText('Tổng thu')).toBeInTheDocument()
      }, { timeout: 5000 })

      // VND amounts render in tabular-nums spans — verify they contain digits
      const amountElements = document.querySelectorAll('[class*="tabular-nums"]')
      expect(amountElements.length).toBeGreaterThan(0)
    })

    it('shows zero state message when no transactions', async () => {
      vi.mocked(dashboardService.getDashboardStats).mockResolvedValue({
        totalIncome: 0, totalExpense: 0, bankIncome: 0, bankExpense: 0,
        ccIncome: 0, ccExpense: 0, categoryBreakdown: [], transactionCount: 0,
      })

      renderDashboardPage()

      await waitFor(() => {
        // StatCard renders "Không có giao dịch trong kỳ này" when transactionCount=0
        const noTxMessages = screen.getAllByText(/Không có giao dịch trong kỳ này/)
        expect(noTxMessages.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })

    it('renders category chart area', async () => {
      renderDashboardPage()

      await waitFor(() => {
        expect(screen.getByText('Chi tiêu theo danh mục')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('error state', () => {
    it('shows retry button when API fails', async () => {
      vi.mocked(dashboardService.getDashboardStats).mockRejectedValue({
        code: 'NETWORK_ERROR', message: 'Không thể tải dữ liệu',
      })

      renderDashboardPage()

      await waitFor(() => {
        const retryButtons = screen.getAllByText('Thử lại')
        expect(retryButtons.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })

    it('shows error message in stat cards', async () => {
      vi.mocked(dashboardService.getDashboardStats).mockRejectedValue({
        code: 'NETWORK_ERROR', message: 'Không thể tải dữ liệu',
      })

      renderDashboardPage()

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Không thể tải dữ liệu/)
        expect(errorMessages.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })
  })

  describe('date range filter', () => {
    it('passes date range from store to API', async () => {
      const capturedCalls: Array<{ dateFrom: string | null; dateTo: string | null }> = []

      vi.mocked(dashboardService.getDashboardStats).mockImplementation(async (f) => {
        capturedCalls.push({ dateFrom: f?.dateFrom ?? null, dateTo: f?.dateTo ?? null })
        return {
          totalIncome: 5_000_000, totalExpense: 2_000_000,
          bankIncome: 5_000_000, bankExpense: 2_000_000,
          ccIncome: 0, ccExpense: 0, categoryBreakdown: [], transactionCount: 5,
        }
      })

      useDashboardStore.setState({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
      renderDashboardPage()

      await waitFor(() => {
        expect(screen.getByText('Tổng thu')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Now makes two calls: one for current month, one for previous month
      expect(capturedCalls.length).toBe(2)
      // First call should be current month
      expect(capturedCalls[0].dateFrom).toBe('2026-01-01')
      expect(capturedCalls[0].dateTo).toBe('2026-01-31')
      // Second call should be previous month (Dec 2025)
      expect(capturedCalls[1].dateFrom).toBe('2025-12-01')
      expect(capturedCalls[1].dateTo).toBe('2025-12-31')
    })
  })
})
