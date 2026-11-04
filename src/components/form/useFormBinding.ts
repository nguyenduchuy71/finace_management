import { useState } from 'react'
import { describedBy } from './form-aria'

/**
 * State của một form dialog (giá trị, lỗi từng ô, lỗi khi gửi) + props chung cho mỗi ô nhập.
 * `field(key, id)`: giá trị, `aria-invalid`, `aria-describedby`, và sửa ô nào thì xoá lỗi của ô đó
 * (cùng lỗi gửi). `set(key, value)` cho control không phải <input> (vd MccPicker).
 */
export function useFormBinding<F extends object, E extends object>(initial: F | (() => F)) {
  const [form, setForm] = useState<F>(initial)
  const [errors, setErrors] = useState<E>({} as E)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = <K extends keyof F>(key: K, value: F[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
  }
  const hasError = (key: keyof F) => Boolean((errors as Partial<Record<keyof F, string>>)[key])

  const field = (key: keyof F, id: string) => ({
    id,
    value: form[key] as string,
    'aria-invalid': hasError(key) ? true : undefined,
    'aria-describedby': describedBy(id, hasError(key)),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      set(key, e.target.value as F[keyof F]),
  })

  return { form, setForm, errors, setErrors, submitError, setSubmitError, set, field }
}
