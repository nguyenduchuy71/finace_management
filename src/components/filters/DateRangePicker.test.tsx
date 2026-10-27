import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { DateRangePicker } from './DateRangePicker'
import { useFilterStore } from '@/stores/filterStore'

describe('DateRangePicker', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters()
  })

  it('hiển thị khoảng ngày đang có trong store', () => {
    useFilterStore.getState().setDateRange('2026-10-01', '2026-10-15')
    render(<DateRangePicker />)
    expect(screen.getByRole('button')).toHaveTextContent('01/10/26 – 15/10/26')
  })

  it('"Xóa bộ lọc" (resetFilters) xoá luôn khoảng ngày đang hiển thị', () => {
    useFilterStore.getState().setDateRange('2026-10-01', '2026-10-15')
    render(<DateRangePicker />)

    act(() => useFilterStore.getState().resetFilters())

    expect(screen.getByRole('button')).toHaveTextContent('Chọn khoảng ngày')
  })
})
