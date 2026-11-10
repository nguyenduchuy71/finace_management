import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog, DialogContent, DialogTitle } from './dialog'

/** Dialog điều khiển bằng state (không DialogTrigger) — cách hầu hết dialog của app được mở. */
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Thêm thẻ</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Form</DialogTitle>
          <input aria-label="Tên thẻ" />
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('Dialog — trả focus khi đóng', () => {
  it('đóng bằng Esc: focus về lại nút đã mở dialog (không rơi về body)', async () => {
    const u = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Thêm thẻ' })
    await u.click(opener)
    await screen.findByRole('dialog')
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })
})
