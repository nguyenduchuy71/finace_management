import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterBar } from './FilterBar'
import { useFilterStore } from '@/stores/filterStore'

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
})
