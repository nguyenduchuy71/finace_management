import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

const VN_TZ = 'Asia/Ho_Chi_Minh'

/**
 * Parse a UTC ISO string and return a TZDate in Vietnam timezone (UTC+7).
 * NEVER use new Date() for display — it parses without timezone and will
 * show the wrong date for transactions near midnight UTC.
 */
export function toVietnamDate(isoUtcString: string): TZDate {
  return new TZDate(isoUtcString, VN_TZ)
}

/**
 * Format a UTC ISO timestamp for display in Vietnam: "15/01/2026"
 */
export function formatDisplayDate(isoUtcString: string): string {
  return format(toVietnamDate(isoUtcString), 'dd/MM/yyyy')
}

/**
 * Format with time: "15/01/2026 14:30"
 */
export function formatDisplayDateTime(isoUtcString: string): string {
  return format(toVietnamDate(isoUtcString), 'dd/MM/yyyy HH:mm')
}
