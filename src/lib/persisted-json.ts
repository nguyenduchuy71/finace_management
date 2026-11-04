/**
 * Đọc/ghi localStorage KHÔNG BAO GIỜ ném lỗi: Safari private / hết dung lượng / bị chặn chỉ làm mất
 * việc nhớ lại sau khi tải trang, không được làm hỏng `set()` của store hay lúc nạp module.
 * Giữ nguyên khoá và định dạng (JSON thuần, không envelope của zustand `persist`) để dữ liệu cũ vẫn đọc được.
 */

/** Đọc JSON; thiếu khoá, JSON hỏng, storage lỗi hoặc `guard` không chấp nhận hình dạng -> `fallback`. */
export function readJSON<T>(key: string, fallback: T, guard?: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    if (guard && !guard(value)) return fallback
    return value as T
  } catch {
    return fallback
  }
}

/** Ghi JSON; lỗi storage bị nuốt. Trả false khi không ghi được. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Đọc chuỗi thô (không JSON), vd `finance-theme` = `dark`. */
export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Ghi chuỗi thô; lỗi storage bị nuốt. */
export function writeString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Xoá khoá; lỗi storage bị nuốt. */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // không xoá được thì thôi — giá trị cũ chỉ còn trong storage bị chặn
  }
}
