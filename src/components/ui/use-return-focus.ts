import { useCallback, useRef } from 'react'

type FocusHandler = ((event: Event) => void) | undefined

/**
 * Trả focus về phần tử đang được focus lúc dialog MỞ, khi dialog đóng.
 * Radix chỉ trả focus về `DialogTrigger` của nó; dialog điều khiển bằng state (mở từ nút/menu ở chỗ khác —
 * hầu hết dialog của app) đóng xong thì focus rơi về <body>, người dùng bàn phím mất vị trí.
 * Ghi nhận ở `onOpenAutoFocus` (lúc này focus chưa chuyển vào dialog), không phải lúc render: content
 * được render cả khi dialog đang đóng.
 */
export function useReturnFocus(onOpenAutoFocus: FocusHandler, onCloseAutoFocus: FocusHandler) {
  const openerRef = useRef<Element | null>(null)
  const handleOpen = useCallback((event: Event) => {
    openerRef.current = document.activeElement
    onOpenAutoFocus?.(event)
  }, [onOpenAutoFocus])
  const handleClose = useCallback((event: Event) => {
    onCloseAutoFocus?.(event)
    if (event.defaultPrevented) return
    const opener = openerRef.current
    if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) {
      event.preventDefault()
      opener.focus()
    }
  }, [onCloseAutoFocus])
  return { onOpenAutoFocus: handleOpen, onCloseAutoFocus: handleClose }
}
