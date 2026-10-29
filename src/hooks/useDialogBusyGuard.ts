import { useState } from 'react'

/**
 * Chặn đóng dialog (Esc / click nền / nút X) trong lúc đang lưu hoặc xoá.
 * `handleOpenChange` truyền cho `<Dialog onOpenChange>`; `setBusy` truyền xuống body của dialog.
 */
export function useDialogBusyGuard(onOpenChange: (next: boolean) => void) {
  const [busy, setBusy] = useState(false)
  const handleOpenChange = (next: boolean) => {
    if (!busy) onOpenChange(next)
  }
  return { busy, setBusy, handleOpenChange }
}
