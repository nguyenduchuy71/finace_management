interface FormFieldProps {
  /** id của control bên trong; lỗi và gợi ý dùng `${id}-error` / `${id}-hint`. */
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}

/**
 * Nhãn + control + gợi ý/lỗi. Lỗi thay thế gợi ý khi có. Control phải tự nối `aria-describedby`
 * tới `${id}-error` (khi có lỗi) hoặc `${id}-hint` — xem `describedBy` trong form-aria.ts — để trình đọc màn hình
 * đọc được cả hai.
 */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
