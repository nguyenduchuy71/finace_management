import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionKindBadge } from './TransactionKindBadge'

describe('TransactionKindBadge', () => {
  it('nội bộ: nhãn + giải thích vì sao không tính thu/chi', () => {
    render(<TransactionKindBadge kind="internal_transfer" />)
    expect(screen.getByText('Nội bộ')).toHaveAttribute('title', expect.stringContaining('không tính vào thu/chi'))
  })
  it('cashback: nhãn, không có title', () => {
    render(<TransactionKindBadge kind="cashback" />)
    expect(screen.getByText('Cashback')).not.toHaveAttribute('title')
  })
  it('thường hoặc thiếu kind: không render gì', () => {
    const { container } = render(<><TransactionKindBadge kind="normal" /><TransactionKindBadge /></>)
    expect(container).toBeEmptyDOMElement()
  })
})
