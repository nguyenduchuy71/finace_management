import { useEffect, useRef, useState } from 'react'

/**
 * Con trỏ + phím mũi tên / Home / End / Enter cho ô tìm kiếm điều khiển một listbox
 * (aria-activedescendant). Mỗi option cần `data-index` để cuộn tới mục đang trỏ.
 *
 * @param count       số mục đang hiển thị (sau khi lọc)
 * @param onSelect    chọn mục ở vị trí đang trỏ
 * @param spaceSelects Space cũng chọn (listbox chọn nhiều, khi ô tìm còn trống)
 */
export function useListboxKeyboard(count: number, onSelect: (index: number) => void, spaceSelects = false) {
  const [rawActiveIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Kẹp con trỏ vào trong mảng thay vì reset bằng useEffect: sau khi lọc, chỉ số cũ có thể vượt
  // độ dài danh sách mới. Tính lúc render tránh một vòng render thừa.
  const activeIndex = Math.min(rawActiveIndex, Math.max(count - 1, 0))

  // Giữ mục đang trỏ luôn nằm trong tầm nhìn khi di chuyển bằng bàn phím
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  function onKeyDown(e: React.KeyboardEvent) {
    // Đang ghép chữ bằng bộ gõ (Telex/VNI trên macOS, IME): Enter là để chốt chữ, không phải chọn mục.
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      // Tính từ chỉ số ĐÃ KẸP: sau khi lọc ngắn lại, chỉ số thô có thể vượt danh sách và phím mũi tên "kẹt"
      setActiveIndex(Math.min(activeIndex + 1, count - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(Math.max(activeIndex - 1, 0))
    } else if (e.key === 'Enter' || (spaceSelects && e.key === ' ')) {
      e.preventDefault()
      if (count > 0) onSelect(activeIndex)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(count - 1)
    }
  }

  return { activeIndex, setActiveIndex, listRef, onKeyDown }
}
