import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import { ConversationStarters } from './ConversationStarters'

describe('ConversationStarters', () => {
  it('renders all 4 starters', () => {
    const onSelect = vi.fn()
    render(<ConversationStarters onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: /Phân tích giao dịch của tôi/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xu hướng chi tiêu là gì/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nhận xét chi tiêu tức thời/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Báo cáo chi tiêu hàng tháng/ })).toBeInTheDocument()
  })

  it('calls onSelect with correct text when chip is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ConversationStarters onSelect={onSelect} />)

    const firstChip = screen.getByRole('button', { name: /Phân tích giao dịch của tôi/ })
    await user.click(firstChip)

    expect(onSelect).toHaveBeenCalledWith('Phân tích giao dịch của tôi')
  })

  it('calls onSelect for different chips with their respective text', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ConversationStarters onSelect={onSelect} />)

    const secondChip = screen.getByRole('button', { name: /Xu hướng chi tiêu là gì/ })
    await user.click(secondChip)

    expect(onSelect).toHaveBeenCalledWith('Xu hướng chi tiêu là gì?')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('button styling includes Tailwind classes', () => {
    const onSelect = vi.fn()
    render(<ConversationStarters onSelect={onSelect} />)

    const button = screen.getByRole('button', { name: /Phân tích giao dịch của tôi/ })
    const className = button.className

    expect(className).toContain('px-3')
    expect(className).toContain('py-1.5')
    expect(className).toContain('rounded-full')
    expect(className).toContain('bg-muted')
    expect(className).toContain('border')
  })

  it('component structure has flex wrap layout', () => {
    const onSelect = vi.fn()
    const { container } = render(<ConversationStarters onSelect={onSelect} />)

    const wrapper = container.querySelector('div')
    expect(wrapper?.className).toContain('flex')
    expect(wrapper?.className).toContain('flex-wrap')
    expect(wrapper?.className).toContain('gap-2')
  })
})
