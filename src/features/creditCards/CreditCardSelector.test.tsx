import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const cards = Array.from({ length: 41 }, (_, i) => ({
  id: `c${i}`, bankName: ['OCB','BIDV','SHB','VPBank'][i % 4],
  cardName: `Card ${i}`, cardNumber: `****${1000 + i}`, cardType: 'visa',
  currency: 'VND', creditLimit: 0, currentBalance: 0,
  statementDate: 1, paymentDueDate: 10, lastUpdated: '2026-01-01T00:00:00Z',
}))
vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: () => ({ data: { data: cards, nextCursor: null, total: 41 }, isLoading: false }),
}))
import { CreditCardSelector } from './CreditCardSelector'

const wrap = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: new QueryClient() }, children)

describe('CreditCardSelector', () => {
  it('render 1 nut combobox thay vi 41 tab', () => {
    render(<CreditCardSelector />, { wrapper: wrap })
    const btn = screen.getByRole('combobox', { name: 'Chọn thẻ tín dụng' })
    expect(btn).toHaveAttribute('aria-haspopup', 'listbox')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('mo ra listbox co day du 41 option', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    const lb = await screen.findByRole('listbox')
    expect(within(lb).getAllByRole('option')).toHaveLength(41)
  })

  it('tim kiem thu hep danh sach', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.type(screen.getByLabelText('Tìm thẻ'), 'Card 7')
    const lb = screen.getByRole('listbox')
    const opts = within(lb).getAllByRole('option')
    expect(opts.length).toBeLessThan(41)
    expect(opts.length).toBeGreaterThan(0)
  })

  it('tim theo ten ngan hang', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.type(screen.getByLabelText('Tìm thẻ'), 'OCB')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(11)
  })

  it('tim theo 4 so cuoi', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.type(screen.getByLabelText('Tìm thẻ'), '1005')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
  })

  it('chon the bang chuot -> dong popover', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.click(within(screen.getByRole('listbox')).getAllByRole('option')[3])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Card 3')
  })

  it('dieu huong + chon bang ban phim', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Card 2')
  })

  it('khong tim thay -> bao ro', async () => {
    const u = userEvent.setup()
    render(<CreditCardSelector />, { wrapper: wrap })
    await u.click(screen.getByRole('combobox'))
    await u.type(screen.getByLabelText('Tìm thẻ'), 'zzzz')
    expect(screen.getByText('Không tìm thấy thẻ nào.')).toBeInTheDocument()
  })
})
