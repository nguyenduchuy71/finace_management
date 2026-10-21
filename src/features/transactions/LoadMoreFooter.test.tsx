import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoadMoreFooter } from './LoadMoreFooter'

describe('LoadMoreFooter', () => {
  it('còn trang: hiện đã tải / tổng và nút "Xem thêm" gọi tải trang kế', () => {
    const onLoadMore = vi.fn()
    render(<LoadMoreFooter hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} loadedCount={50} totalCount={132} />)
    expect(screen.getByText(/Đang hiện/)).toHaveTextContent('Đang hiện 50 / 132 giao dịch')
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('đang tải trang kế: khoá nút để không bấm đúp tải trùng trang', () => {
    render(<LoadMoreFooter hasNextPage isFetchingNextPage onLoadMore={vi.fn()} loadedCount={50} totalCount={132} />)
    expect(screen.getByRole('button', { name: 'Đang tải...' })).toBeDisabled()
  })

  it('không rõ tổng: không hiện dòng "x / y"', () => {
    render(<LoadMoreFooter hasNextPage isFetchingNextPage={false} onLoadMore={vi.fn()} loadedCount={50} />)
    expect(screen.queryByText(/Đang hiện/)).not.toBeInTheDocument()
  })

  it('hết trang: báo đã hiển thị tất cả', () => {
    render(<LoadMoreFooter hasNextPage={false} isFetchingNextPage={false} onLoadMore={vi.fn()} loadedCount={73} totalCount={73} />)
    expect(screen.getByText('Đã hiển thị tất cả 73 giao dịch')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
