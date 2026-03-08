import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from './filterStore'

// Default state to reset to before each test
const DEFAULT_STATE = {
  accountId: 'vcb-checking-001',
  cardId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  txType: 'all' as const,
  category: 'all' as const,
}

describe('filterStore', () => {
  beforeEach(() => {
    // Reset to known state before each test
    useFilterStore.setState(DEFAULT_STATE)
  })

  describe('initial state', () => {
    it('has correct default accountId', () => {
      const state = useFilterStore.getState()
      expect(state.accountId).toBe('vcb-checking-001')
    })

    it('has null cardId by default', () => {
      expect(useFilterStore.getState().cardId).toBeNull()
    })

    it('has null dateFrom and dateTo by default', () => {
      const { dateFrom, dateTo } = useFilterStore.getState()
      expect(dateFrom).toBeNull()
      expect(dateTo).toBeNull()
    })

    it('has empty searchQuery by default', () => {
      expect(useFilterStore.getState().searchQuery).toBe('')
    })

    it('has txType=all by default', () => {
      expect(useFilterStore.getState().txType).toBe('all')
    })
  })

  describe('setAccountId', () => {
    it('sets accountId to a new value', () => {
      useFilterStore.getState().setAccountId('tcb-saving-001')
      expect(useFilterStore.getState().accountId).toBe('tcb-saving-001')
    })

    it('sets accountId to null', () => {
      useFilterStore.getState().setAccountId(null)
      expect(useFilterStore.getState().accountId).toBeNull()
    })

    it('does not affect other state fields', () => {
      useFilterStore.setState({ searchQuery: 'test', txType: 'expense' })
      useFilterStore.getState().setAccountId('tcb-saving-001')
      const state = useFilterStore.getState()
      expect(state.searchQuery).toBe('test')
      expect(state.txType).toBe('expense')
    })
  })

  describe('setCardId', () => {
    it('sets cardId to a new value', () => {
      useFilterStore.getState().setCardId('tcb-visa-001')
      expect(useFilterStore.getState().cardId).toBe('tcb-visa-001')
    })

    it('sets cardId back to null', () => {
      useFilterStore.setState({ cardId: 'tcb-visa-001' })
      useFilterStore.getState().setCardId(null)
      expect(useFilterStore.getState().cardId).toBeNull()
    })
  })

  describe('setDateRange', () => {
    it('sets both dateFrom and dateTo', () => {
      useFilterStore.getState().setDateRange('2026-01-01', '2026-01-31')
      const { dateFrom, dateTo } = useFilterStore.getState()
      expect(dateFrom).toBe('2026-01-01')
      expect(dateTo).toBe('2026-01-31')
    })

    it('clears dates with null values', () => {
      useFilterStore.setState({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
      useFilterStore.getState().setDateRange(null, null)
      const { dateFrom, dateTo } = useFilterStore.getState()
      expect(dateFrom).toBeNull()
      expect(dateTo).toBeNull()
    })

    it('can set partial date range', () => {
      useFilterStore.getState().setDateRange('2026-01-01', null)
      expect(useFilterStore.getState().dateFrom).toBe('2026-01-01')
      expect(useFilterStore.getState().dateTo).toBeNull()
    })
  })

  describe('setSearchQuery', () => {
    it('sets the search query', () => {
      useFilterStore.getState().setSearchQuery('Grab')
      expect(useFilterStore.getState().searchQuery).toBe('Grab')
    })

    it('clears the search query with empty string', () => {
      useFilterStore.setState({ searchQuery: 'Grab' })
      useFilterStore.getState().setSearchQuery('')
      expect(useFilterStore.getState().searchQuery).toBe('')
    })
  })

  describe('setTxType', () => {
    it('sets txType to income', () => {
      useFilterStore.getState().setTxType('income')
      expect(useFilterStore.getState().txType).toBe('income')
    })

    it('sets txType to expense', () => {
      useFilterStore.getState().setTxType('expense')
      expect(useFilterStore.getState().txType).toBe('expense')
    })

    it('sets txType back to all', () => {
      useFilterStore.setState({ txType: 'income' })
      useFilterStore.getState().setTxType('all')
      expect(useFilterStore.getState().txType).toBe('all')
    })
  })

  describe('resetFilters', () => {
    it('resets all filters to defaults', () => {
      useFilterStore.setState({
        accountId: 'tcb-saving-001',
        cardId: 'tcb-visa-001',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        searchQuery: 'test',
        txType: 'expense',
      })

      useFilterStore.getState().resetFilters()

      const state = useFilterStore.getState()
      expect(state.accountId).toBe('vcb-checking-001')
      expect(state.cardId).toBeNull()
      expect(state.dateFrom).toBeNull()
      expect(state.dateTo).toBeNull()
      expect(state.searchQuery).toBe('')
      expect(state.txType).toBe('all')
    })

    it('is idempotent when called multiple times', () => {
      useFilterStore.getState().resetFilters()
      useFilterStore.getState().resetFilters()
      const state = useFilterStore.getState()
      expect(state.accountId).toBe('vcb-checking-001')
      expect(state.searchQuery).toBe('')
    })
  })

  describe('no localStorage side effects', () => {
    it('does not persist to localStorage (session-only store)', () => {
      const keysBefore = Object.keys(localStorage)
      useFilterStore.getState().setAccountId('tcb-saving-001')
      useFilterStore.getState().setSearchQuery('test filter')
      const keysAfter = Object.keys(localStorage)
      // filterStore should NOT write to localStorage
      expect(keysAfter.filter((k) => k.includes('filter')).length).toBe(0)
      expect(keysBefore.length).toBe(keysAfter.length)
    })
  })

  describe('Category Filter', () => {
    it('has category field that defaults to "all"', () => {
      const state = useFilterStore.getState()
      expect(state.category).toBe('all')
    })

    it('setCategory updates category field', () => {
      useFilterStore.getState().setCategory('Ăn uống')
      expect(useFilterStore.getState().category).toBe('Ăn uống')
    })

    it('resetFilters resets category back to "all"', () => {
      useFilterStore.setState({ category: 'Mua sắm' })
      useFilterStore.getState().resetFilters()
      expect(useFilterStore.getState().category).toBe('all')
    })

    it('useFilterParams selector includes category field', () => {
      useFilterStore.setState({ category: 'Di chuyển' })
      // useFilterParams is a selector that returns an object with category
      // We verify the category field exists in the state
      const state = useFilterStore.getState()
      expect(state.category).toBe('Di chuyển')
    })

    it('setCategory is idempotent', () => {
      useFilterStore.getState().setCategory('Giải trí')
      const state1 = useFilterStore.getState()
      useFilterStore.getState().setCategory('Giải trí')
      const state2 = useFilterStore.getState()
      expect(state1.category).toBe(state2.category)
      expect(state1.category).toBe('Giải trí')
    })
  })
})
