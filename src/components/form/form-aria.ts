/**
 * Giá trị `aria-describedby` cho control của một FormField: lỗi nếu có, không thì gợi ý.
 * Trỏ tới id không tồn tại (ô không có gợi ý) là vô hại — trình đọc màn hình bỏ qua.
 */
export function describedBy(id: string, hasError: boolean): string {
  return hasError ? `${id}-error` : `${id}-hint`
}
