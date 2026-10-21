import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardSearchListbox } from './CardSearchListbox'
import type { CreditCard } from '@/types/creditCard'

const mk = (id: string, cardName: string, bankName = 'SHB'): CreditCard => ({
  id, bankName, cardName, cardNumber: `****${id.padStart(4, '0')}`, cardType: 'visa', currency: 'VND',
  creditLimit: 0, currentBalance: 0, statementDate: 15, paymentDueDate: 5, cashbackMonthlyCap: null,
  lastUpdated: '2026-01-01T00:00:00Z',
})
const CARDS = [mk('1', 'Alpha'), mk('2', 'Beta'), mk('3', 'Gamma'), mk('4', 'Delta'), mk('5', 'Omega')]

function setup() {
  const onPick = vi.fn()
  render(<CardSearchListbox id="lb" cards={CARDS} selectedIds={new Set()} onPick={onPick} />)
  return { onPick, input: screen.getByRole('textbox', { name: 'Tìm thẻ' }) }
}

describe('CardSearchListbox — bàn phím', () => {
  it('gõ lọc thì con trỏ về kết quả đầu: Enter không chọn mục đã trỏ trước đó', async () => {
    const { onPick, input } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}') // trỏ Gamma
    await userEvent.type(input, 'ta') // Beta, Delta
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('2')
  })
})
