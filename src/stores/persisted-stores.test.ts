import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Nạp store MỚI sau khi gieo localStorage theo định dạng cũ: kiểm đúng khoá + định dạng không đổi,
// và storage lỗi không làm hỏng việc nạp module / set().

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); document.documentElement.classList.remove('dark') })

const throwing = () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
}

describe('budgetStore: dữ liệu cũ', () => {
  it('đọc JSON thuần ở khoá finance-budgets', async () => {
    localStorage.setItem('finance-budgets', JSON.stringify({ 'Ăn uống': 5000000 }))
    const { useBudgetStore } = await import('./budgetStore')
    expect(useBudgetStore.getState().budgets).toEqual({ 'Ăn uống': 5000000 })
  })

  it('sai hình dạng hoặc JSON hỏng -> {}', async () => {
    localStorage.setItem('finance-budgets', '[1,2]')
    expect((await import('./budgetStore')).useBudgetStore.getState().budgets).toEqual({})
    vi.resetModules()
    localStorage.setItem('finance-budgets', '{oops')
    expect((await import('./budgetStore')).useBudgetStore.getState().budgets).toEqual({})
  })

  it('storage ném lỗi: nạp và setBudget không ném, state vẫn cập nhật', async () => {
    throwing()
    const { useBudgetStore } = await import('./budgetStore')
    expect(() => useBudgetStore.getState().setBudget('Khác', 1)).not.toThrow()
    expect(useBudgetStore.getState().budgets.Khác).toBe(1)
  })
})

describe('categoryOverrideStore: dữ liệu cũ', () => {
  it('đọc mảng [txId, category] ở khoá finance-category-overrides, bỏ dòng hỏng', async () => {
    localStorage.setItem('finance-category-overrides', JSON.stringify([['t1', 'Ăn uống'], 'rác', [5, 'Khác'], ['t2', 'Hóa đơn']]))
    const { useCategoryOverrideStore } = await import('./categoryOverrideStore')
    expect([...useCategoryOverrideStore.getState().overrides]).toEqual([['t1', 'Ăn uống'], ['t2', 'Hóa đơn']])
  })

  it('không phải mảng / JSON hỏng -> rỗng', async () => {
    localStorage.setItem('finance-category-overrides', '{"a":1}')
    expect((await import('./categoryOverrideStore')).useCategoryOverrideStore.getState().overrides.size).toBe(0)
  })

  it('storage ném lỗi: setOverride không ném', async () => {
    throwing()
    const { useCategoryOverrideStore } = await import('./categoryOverrideStore')
    expect(() => useCategoryOverrideStore.getState().setOverride('t1', 'Khác')).not.toThrow()
    expect(useCategoryOverrideStore.getState().overrides.get('t1')).toBe('Khác')
  })
})

describe('themeStore: dữ liệu cũ', () => {
  it('chuỗi thô "dark" ở khoá finance-theme -> tối; giá trị lạ -> sáng', async () => {
    localStorage.setItem('finance-theme', 'dark')
    expect((await import('./themeStore')).useThemeStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    vi.resetModules()
    localStorage.setItem('finance-theme', 'bậy')
    expect((await import('./themeStore')).useThemeStore.getState().theme).toBe('light')
  })

  it('toggle ghi chuỗi thô; storage lỗi vẫn đổi được theme', async () => {
    const { useThemeStore } = await import('./themeStore')
    useThemeStore.getState().toggleTheme()
    expect(localStorage.getItem('finance-theme')).toBe('dark')
    throwing()
    expect(() => useThemeStore.getState().toggleTheme()).not.toThrow()
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('storage lỗi ngay lúc nạp module không ném', async () => {
    throwing()
    expect((await import('./themeStore')).useThemeStore.getState().theme).toBe('light')
  })
})

describe('chatStore: dữ liệu cũ', () => {
  const msg = { id: 'm1', role: 'user', content: 'hi', timestamp: 1 }

  it('đọc lịch sử + cấu hình ở khoá cũ', async () => {
    localStorage.setItem('finance-chat-history', JSON.stringify([msg]))
    localStorage.setItem('finance-chat-api-config', JSON.stringify({ apiKey: 'k', model: 'claude-sonnet-5-5' }))
    const { useChatStore } = await import('./chatStore')
    expect(useChatStore.getState().messages).toEqual([msg])
    expect(useChatStore.getState().apiConfig).toEqual({ apiKey: 'k', model: 'claude-sonnet-5-5' })
  })

  it('sai hình dạng -> mặc định; resetForSignOut xoá khoá', async () => {
    localStorage.setItem('finance-chat-history', '{"a":1}')
    localStorage.setItem('finance-chat-api-config', '"x"')
    const { useChatStore } = await import('./chatStore')
    expect(useChatStore.getState().messages).toEqual([])
    expect(useChatStore.getState().apiConfig).toBeNull()
    useChatStore.getState().setApiConfig({ apiKey: 'k', model: 'claude-sonnet-5-5' })
    expect(localStorage.getItem('finance-chat-api-config')).not.toBeNull()
    useChatStore.getState().resetForSignOut()
    expect(localStorage.getItem('finance-chat-api-config')).toBeNull()
  })

  it('storage ném lỗi: nạp và addMessage không ném', async () => {
    throwing()
    const { useChatStore } = await import('./chatStore')
    expect(() => useChatStore.getState().addMessage({ role: 'user', content: 'x' })).not.toThrow()
    expect(useChatStore.getState().messages).toHaveLength(1)
  })
})
