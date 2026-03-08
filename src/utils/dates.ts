import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
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

/**
 * Calculate percentage change from previousAmount to currentAmount.
 * Returns null if previousAmount <= 0 (cannot calculate % change from zero/negative baseline).
 * Returns rounded whole number percentage: ((current - previous) / previous) * 100
 */
export function calculateMonthDelta(currentAmount: number, previousAmount: number): number | null {
  if (previousAmount <= 0) {
    return null
  }
  return Math.round(((currentAmount - previousAmount) / previousAmount) * 100)
}

/**
 * Calculate the previous month's date range in Vietnam timezone (UTC+7).
 * If dateFrom is provided, use it as reference to determine current month.
 * Otherwise, use today's date in Vietnam timezone.
 * Returns { prevFrom, prevTo } as ISO format strings (YYYY-MM-DD).
 */
export function getPreviousMonthDateRange(
  dateFrom: string | null,
  dateTo: string | null
): { prevFrom: string; prevTo: string } {
  // Use dateFrom as reference, or today in Vietnam timezone
  const referenceDate = dateFrom ? new TZDate(dateFrom, VN_TZ) : new TZDate(new Date().toISOString(), VN_TZ)

  // Get the month one month before the reference month
  const previousMonth = subMonths(referenceDate, 1)

  // Get first and last day of previous month
  const prevFrom = format(startOfMonth(previousMonth), 'yyyy-MM-dd')
  const prevTo = format(endOfMonth(previousMonth), 'yyyy-MM-dd')

  return { prevFrom, prevTo }
}
