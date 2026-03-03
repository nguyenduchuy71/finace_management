import { TZDate } from '@date-fns/tz'
import { format, subDays } from 'date-fns'
import type { CreditCardTransaction } from '@/types/creditCard'

const VN_TZ = 'Asia/Ho_Chi_Minh'

/**
 * Represents a single billing cycle period for a credit card.
 *
 * Boundary convention: statement cuts at 17:00 UTC = midnight (00:00) VN time (UTC+7).
 * So `startISO` = '2026-02-15T17:00:00Z' means the cycle starts on 16 Feb 2026 00:00 VN.
 */
export interface BillingCycle {
  startISO: string              // UTC ISO of exclusive cycle start boundary
  endISO: string                // UTC ISO of exclusive cycle end boundary
  startDisplay: string          // "16/02/2026" — first VN calendar day of cycle
  endDisplay: string            // "15/03/2026" — last VN calendar day of cycle
  statementDateDisplay: string  // same as endDisplay — "ngày sao kê"
  daysUntilClose: number        // calendar days from now to endISO, ceiling
}

/**
 * Groups transactions by billing cycle for display in the credit card page.
 */
export interface BillingCycleGroupData {
  cycleKey: string              // = cycleStartISO (used as React key)
  cycleStartISO: string         // UTC ISO of cycle start
  cycleEndISO: string           // UTC ISO of cycle end
  isCurrentCycle: boolean
  transactions: CreditCardTransaction[]
}

/**
 * Compute the current billing cycle for a card given its statementDay and the current time.
 *
 * @param statementDay - Day of month when statement is cut (e.g. 15)
 * @param nowISO - Current time as UTC ISO string
 * @returns BillingCycle with display strings and days until close
 */
export function computeCurrentCycle(
  statementDay: number,
  nowISO: string
): BillingCycle {
  // Step 1: Get VN local date components
  const vnDate = new TZDate(nowISO, VN_TZ)
  const y = vnDate.getFullYear()
  const m = vnDate.getMonth() // 0-indexed
  const vnDay = vnDate.getDate()

  let startUTC: Date
  let endUTC: Date

  if (vnDay <= statementDay) {
    // Cycle started last month
    const prevM = m === 0 ? 11 : m - 1
    const prevY = m === 0 ? y - 1 : y
    startUTC = new Date(Date.UTC(prevY, prevM, statementDay, 17, 0, 0))
    endUTC = new Date(Date.UTC(y, m, statementDay, 17, 0, 0))
  } else {
    // Cycle started this month
    const nextM = m === 11 ? 0 : m + 1
    const nextY = m === 11 ? y + 1 : y
    startUTC = new Date(Date.UTC(y, m, statementDay, 17, 0, 0))
    endUTC = new Date(Date.UTC(nextY, nextM, statementDay, 17, 0, 0))
  }

  // Step 2: Convert to VN timezone for display
  const startVN = new TZDate(startUTC.toISOString(), VN_TZ)
  const endVN = new TZDate(endUTC.toISOString(), VN_TZ)

  // Step 3: Format display dates
  // startVN is already at midnight of the first day of the cycle (day after statementDay)
  const startDisplay = format(startVN, 'dd/MM/yyyy')
  // endVN is at midnight of (statementDay + 1), so subtract 1 day to get last inclusive day
  const endDisplay = format(subDays(endVN, 1), 'dd/MM/yyyy')
  const statementDateDisplay = endDisplay

  // Step 4: Days until close
  const nowMs = new Date(nowISO).getTime()
  const daysUntilClose = Math.ceil((endUTC.getTime() - nowMs) / 86_400_000)

  return {
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
    startDisplay,
    endDisplay,
    statementDateDisplay,
    daysUntilClose,
  }
}

/**
 * Group an array of credit card transactions by their billing cycle.
 *
 * Pending transactions (no billingCycleStart) are assigned to the currentCycle.
 * Posted transactions are grouped by their billingCycleStart key.
 * Groups are returned sorted newest-first.
 *
 * @param transactions - Array of CreditCardTransaction
 * @param currentCycle - The current billing cycle (from computeCurrentCycle)
 * @returns Array of BillingCycleGroupData sorted by cycleKey descending
 */
export function groupTransactionsByCycle(
  transactions: CreditCardTransaction[],
  currentCycle: BillingCycle
): BillingCycleGroupData[] {
  const groups = new Map<string, BillingCycleGroupData>()

  for (const tx of transactions) {
    let cycleKey: string
    let cycleStartISO: string
    let cycleEndISO: string

    if (tx.billingCycleStart && tx.billingCycleEnd) {
      // Posted transaction — use its own cycle boundaries
      cycleKey = tx.billingCycleStart
      cycleStartISO = tx.billingCycleStart
      cycleEndISO = tx.billingCycleEnd
    } else {
      // Pending transaction — assign to current cycle
      cycleKey = currentCycle.startISO
      cycleStartISO = currentCycle.startISO
      cycleEndISO = currentCycle.endISO
    }

    const isCurrentCycle = cycleKey === currentCycle.startISO

    if (!groups.has(cycleKey)) {
      groups.set(cycleKey, {
        cycleKey,
        cycleStartISO,
        cycleEndISO,
        isCurrentCycle,
        transactions: [],
      })
    }

    groups.get(cycleKey)!.transactions.push(tx)
  }

  // Return sorted newest-first (descending by cycleKey ISO string)
  return Array.from(groups.values()).sort((a, b) =>
    b.cycleKey.localeCompare(a.cycleKey)
  )
}

/**
 * Format a billing cycle's UTC ISO boundaries into VN-local inclusive display dates.
 *
 * @param cycleStartISO - UTC ISO string of cycle start boundary (exclusive, = midnight VN of first day)
 * @param cycleEndISO - UTC ISO string of cycle end boundary (exclusive, = midnight VN of day after last day)
 * @returns { startDisplay, endDisplay } as "dd/MM/yyyy" in Vietnam timezone
 */
export function formatCycleDateRange(
  cycleStartISO: string,
  cycleEndISO: string
): { startDisplay: string; endDisplay: string } {
  const startVN = new TZDate(cycleStartISO, VN_TZ)
  const endVN = new TZDate(cycleEndISO, VN_TZ)
  return {
    startDisplay: format(startVN, 'dd/MM/yyyy'),
    endDisplay: format(subDays(endVN, 1), 'dd/MM/yyyy'),
  }
}
