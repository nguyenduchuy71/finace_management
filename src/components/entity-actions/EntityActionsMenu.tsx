import { useRef } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface EntityActionsMenuProps {
  /** Tên cho nút "⋯", vd "Thao tác với thẻ đang chọn". */
  label: string
  /** Danh từ trong nhãn mục: "thẻ" -> "Sửa thẻ" / "Xoá thẻ". */
  noun: string
  onEdit: () => void
  onDelete: () => void
}

/**
 * Menu "⋯" đặt ngay cạnh thẻ/TK đang chọn: rõ đang sửa/xoá cái gì, và Xoá không còn đứng ngang hàng
 * nút chính ở đầu trang (dễ bấm nhầm). Xoá vẫn qua dialog xác nhận như cũ.
 */
export function EntityActionsMenu({ label, noun, onEdit, onDelete }: EntityActionsMenuProps) {
  // Dialog ghi nhớ phần tử đang focus lúc MỞ để trả focus khi đóng (useReturnFocus). Mở thẳng trong onSelect
  // thì nó nhớ mục menu — đã bị gỡ — và focus rơi về <body>. Nên: đợi menu đóng, đưa focus về nút ⋯, rồi mới mở.
  const triggerRef = useRef<HTMLButtonElement>(null)
  const later = (fn: () => void) => () => {
    setTimeout(() => { triggerRef.current?.focus(); fn() }, 0)
  }
  return (
    // modal={false}: mở Dialog từ mục menu modal để lại `pointer-events: none` trên body (lỗi Radix đã biết)
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        <Button variant="outline" size="icon" className="touch-target shrink-0" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={later(onEdit)}><Pencil /> Sửa {noun}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={later(onDelete)}><Trash2 /> Xoá {noun}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
