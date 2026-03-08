/**
 * Format an integer VND amount as "đ 1.500.000"
 * Uses Intl.NumberFormat for locale-correct dot grouping separators,
 * then manually normalises the symbol position and character.
 * Locked decision: symbol = "đ" (U+0111), position = before number, space separator.
 */
export function formatVND(amount: number): string {
  // vi-VN uses dots as thousand separators, no decimals for VND
  const formatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  // Extract only digits and dots — platform-safe because the number part
  // (digits + dots) is always consistent in vi-VN locale even when the
  // symbol position varies by OS ("1.500.000 ₫" or "₫ 1.500.000" etc.)
  const digits = formatted.replace(/[^\d.]/g, '')

  return `đ ${digits}`
}

/**
 * Format with sign prefix for expense display: "- đ 500.000"
 */
export function formatVNDSigned(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '- ' : ''
  return `${sign}${formatVND(abs)}`
}

/**
 * Parse VND currency input (with thousand separators) to integer.
 * Examples: "100.000" → 100000, "1.500.000" → 1500000, "0" → 0, "" → 0
 * Removes all non-digit characters and parses the remaining digits.
 */
export function parseVND(input: string): number {
  if (!input || !input.trim()) {
    return 0
  }
  // Extract all digits, ignoring thousand separators and other characters
  const digitsOnly = input.replace(/\D/g, '')
  return digitsOnly ? parseInt(digitsOnly, 10) : 0
}
