import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FilterBar } from './FilterBar'
import { useFilterStore } from '@/stores/filterStore'

// Mock ExportButton to isolate FilterBar tests from QueryClient dependencies
vi.mock('./ExportButton', () => ({
  ExportButton: () => <button data-testid="export-button">Xuất CSV</button>,
}))

// Reset store before each test
beforeEach(() => {
  useFilterStore.setState({
    accountId: 'vcb-checking-001',
    cardId: null,
    dateFrom: null,
    dateTo: null,
    searchQuery: '',
    txType: 'all',
    category: 'all',
  })
})

afterEach(() => {
  useFilterStore.setState({
    accountId: 'vcb-checking-001',
    cardId: null,
    dateFrom: null,
    dateTo: null,
    searchQuery: '',
    txType: 'all',
    category: 'all',
  })
})

describe('FilterBar', () => {
  it('renders FilterBar component', () => {
    render(<FilterBar />)
    // The component should render without crashing
    const filterBar = document.querySelector('.flex.flex-wrap')
    expect(filterBar).toBeTruthy()
  })

  it('does not show reset button when no filters are active', () => {
    render(<FilterBar />)
    const resetButtons = screen.queryAllByText(/Xóa bộ lọc/)
    expect(resetButtons.length).toBe(0)
  })

  it('shows reset button when category filter is active', () => {
    useFilterStore.setState({ category: 'Ăn uống' })
    render(<FilterBar />)

    const resetButtons = screen.queryAllByText(/Xóa bộ lọc/)
    expect(resetButtons.length).toBeGreaterThan(0)
  })

  it('includes category in filter state', () => {
    const state = useFilterStore.getState()
    expect(state.category).toBe('all')
    expect(state.setCategory).toBeDefined()
  })

  it('resets category to all when resetFilters is called', () => {
    useFilterStore.setState({ category: 'Mua sắm' })
    expect(useFilterStore.getState().category).toBe('Mua sắm')

    useFilterStore.getState().resetFilters()
    expect(useFilterStore.getState().category).toBe('all')
  })

  it('includes category in hasActiveFilters logic', () => {
    useFilterStore.setState({ category: 'Di chuyển' })
    render(<FilterBar />)

    // When category is not 'all', reset button should be visible
    const resetButtons = screen.queryAllByText(/Xóa bộ lọc/)
    expect(resetButtons.length).toBeGreaterThan(0)
  })

  it('renders ExportButton in the filter bar', () => {
    render(<FilterBar />)
    expect(screen.getByTestId('export-button')).toBeInTheDocument()
    expect(screen.getByText('Xuất CSV')).toBeInTheDocument()
  })
})

describe('FilterBar — sheet bộ lọc trên điện thoại', () => {
  it('nút "Bộ lọc" đếm bộ lọc đang bật (không tính ô tìm) và mở sheet chứa các control', async () => {
    useFilterStore.setState({ category: 'Ăn uống', txType: 'expense', searchQuery: 'grab' })
    render(<FilterBar />)
    const trigger = screen.getByRole('button', { name: 'Bộ lọc, 2 đang bật' })
    fireEvent.click(trigger)
    const sheet = await screen.findByRole('dialog', { name: 'Bộ lọc' })
    expect(within(sheet).getByRole('combobox', { name: 'Loại giao dịch' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Ăn uống/ })).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(useFilterStore.getState()).toMatchObject({ category: 'all', txType: 'all' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Xem kết quả' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('không bật gì: nút không có số đếm', () => {
    render(<FilterBar />)
    expect(screen.getByRole('button', { name: 'Bộ lọc' })).toBeInTheDocument()
  })
})
