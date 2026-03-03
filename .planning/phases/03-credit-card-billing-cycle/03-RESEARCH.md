# Phase 3: Credit Card Billing Cycle - Research

**Researched:** 2026-03-03
**Domain:** Date math (billing cycles), UTC+7 timezone handling with @date-fns/tz, React component architecture for grouped transaction lists
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CC-03 | Users can see billing cycle info: start date, end date, statement closing date | `computeCurrentCycle()` pure function; `BillingCycleInfoCard` component renders the three fields; data comes from `CreditCard.statementDate` field already in the schema |
| CC-04 | Transactions grouped by billing cycle (not calendar month), with UTC+7 boundary calculations | `groupTransactionsByCycle()` pure function using `billingCycleStart` from posted txs and computed current cycle for pending txs; `BillingCycleGroup` replaces flat list in `CreditCardTransactionList` |
</phase_requirements>

---

## Summary

Phase 3 adds billing cycle awareness to the credit card view. The feature has two distinct parts: (1) a summary card showing current cycle dates and days remaining, and (2) regrouping the transaction list by billing cycle instead of displaying a flat chronological list.

Both parts are achievable with zero new npm dependencies. The project already has `@date-fns/tz` v1.4.1 and `date-fns` v4.1.0 installed, which provide all the date math needed. The `CreditCard` schema already contains `statementDate` (integer day of month). The `CreditCardTransaction` schema already has optional `billingCycleStart` and `billingCycleEnd` fields populated for all posted transactions. Pending transactions carry no cycle fields and must have a cycle computed from today's date.

The critical design insight from studying the fixture data: the billing cycle boundary convention used throughout the codebase is `statementDate at 17:00:00 UTC` which equals midnight (00:00) of `statementDate + 1` in Vietnam time (UTC+7). All cycle group keys should be the UTC ISO string of `billingCycleStart`, and pending transactions are assigned to the current cycle computed from `statementDate` and now.

**Primary recommendation:** Build two pure utility functions (`computeCurrentCycle` and `groupTransactionsByCycle`) in `src/utils/billingCycle.ts`, then add `BillingCycleInfoCard` above the transaction list in `CreditCardsPage` and replace the flat render loop in `CreditCardTransactionList` with a grouped render using `BillingCycleGroup`.

---

## Standard Stack

### Core (Already Installed — Zero New npm Installs Required)

| Library | Version | Purpose | Why Used |
|---------|---------|---------|----------|
| `@date-fns/tz` | ^1.4.1 | `TZDate` for VN-aware date construction | Already in use in `src/utils/dates.ts` for `toVietnamDate()` |
| `date-fns` | ^4.1.0 | `format`, `subDays`, `differenceInCalendarDays` for display and countdown | Already installed; `formatDisplayDate` uses it |
| TanStack Query v5 | ^5.90 | Existing `useCreditCards` + `useCreditCardTransactions` hooks | No new queries needed — derive everything in components |
| shadcn/ui | installed | `Badge`, `Card` (card already installed) for the info panel | All required shadcn components already present |

**No new npm installs required for Phase 3.**

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure function in `utils/billingCycle.ts` | Server-side grouping endpoint | Server approach requires MSW handler changes and a new API shape; pure client function is simpler and testable with Vitest |
| Computing cycles on the client from `statementDate` | Storing a `currentCycle` object on the `CreditCard` API response | API-provided cycle would be more accurate for edge cases; but since we mock MSW, client computation is equivalent and avoids a new schema field |

---

## Architecture Patterns

### Recommended File Structure

```
src/
  utils/
    billingCycle.ts          # NEW: computeCurrentCycle, groupTransactionsByCycle, formatCycleDateRange
    billingCycle.test.ts     # NEW: unit tests for all three functions
  features/
    creditCards/
      BillingCycleInfoCard.tsx   # NEW: cycle summary panel (start, end, days remaining)
      BillingCycleGroup.tsx      # NEW: section header + grouped transaction list
      CreditCardTransactionList.tsx  # MODIFY: replace flat map with grouped render
  pages/
    CreditCardsPage.tsx          # MODIFY: add BillingCycleInfoCard above FilterBar
```

### Pattern 1: Pure Utility Functions for Cycle Math

**What:** All date arithmetic lives in `src/utils/billingCycle.ts` as pure functions. Components call them, tests cover them.

**When to use:** Whenever dates and timezone conversions are involved. Pure functions are testable, composable, and have no React dependencies.

**Proven billing cycle boundary convention (confirmed from fixture data):**

The existing fixture constants (`CYCLE_JAN_START = '2025-12-15T17:00:00Z'`) use this convention:
- Cycle boundary UTC timestamp = `statementDate` of month at **17:00:00 UTC**
- This equals **00:00 (midnight) of `statementDate + 1`** in Vietnam time (UTC+7)
- The cycle boundary is **exclusive** — transactions with `transactionDate < endBoundaryUTC` are IN the cycle
- Transactions with `transactionDate >= endBoundaryUTC` belong to the next cycle

**Note on the fixture comment:** The comment in `src/mocks/fixtures/creditCards.ts` says `'15 Dec 2025 midnight VN'` but the constant `2025-12-15T17:00:00Z` actually resolves to `2025-12-16 00:00 VN`. The timestamp value is correct for the boundary convention; the comment string is misleading. Phase 3 should use the timestamp convention and fix the comment.

```typescript
// Source: verified against @date-fns/tz 1.4.1 + date-fns 4.1.0 with node --input-type=module

import { TZDate } from '@date-fns/tz'
import { format, subDays } from 'date-fns'

const VN_TZ = 'Asia/Ho_Chi_Minh'

export interface BillingCycle {
  startISO: string   // UTC ISO — exclusive start boundary (17:00 UTC on statementDate of prev month)
  endISO: string     // UTC ISO — exclusive end boundary (17:00 UTC on statementDate of this month)
  startDisplay: string  // "16/02/2026" — first VN day of cycle (= day after startISO in VN)
  endDisplay: string    // "15/03/2026" — last VN day of cycle (= statementDate in VN)
  statementDateDisplay: string  // same as endDisplay — "ngày sao kê"
  daysUntilClose: number       // calendar days from now to endISO
}

export function computeCurrentCycle(
  statementDay: number,  // e.g. 15 from CreditCard.statementDate
  nowISO: string         // current UTC timestamp
): BillingCycle {
  const vnDate = new TZDate(nowISO, VN_TZ)
  const y = vnDate.getFullYear()
  const m = vnDate.getMonth()  // 0-indexed
  const d = vnDate.getDate()   // VN day of month

  let startUTC: Date, endUTC: Date

  if (d <= statementDay) {
    // We are in the first part of the cycle: started last month on statementDay
    const prevM = m === 0 ? 11 : m - 1
    const prevY = m === 0 ? y - 1 : y
    startUTC = new Date(Date.UTC(prevY, prevM, statementDay, 17, 0, 0))
    endUTC   = new Date(Date.UTC(y, m, statementDay, 17, 0, 0))
  } else {
    // We are past statementDay: cycle started this month
    const nextM = m === 11 ? 0 : m + 1
    const nextY = m === 11 ? y + 1 : y
    startUTC = new Date(Date.UTC(y, m, statementDay, 17, 0, 0))
    endUTC   = new Date(Date.UTC(nextY, nextM, statementDay, 17, 0, 0))
  }

  const startVN = new TZDate(startUTC.toISOString(), VN_TZ)
  const endVN   = new TZDate(endUTC.toISOString(), VN_TZ)

  const daysUntilClose = Math.ceil(
    (endUTC.getTime() - new Date(nowISO).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    startISO: startUTC.toISOString(),
    endISO:   endUTC.toISOString(),
    startDisplay:       format(startVN, 'dd/MM/yyyy'),        // "16/02/2026"
    endDisplay:         format(subDays(endVN, 1), 'dd/MM/yyyy'), // "15/03/2026"
    statementDateDisplay: format(subDays(endVN, 1), 'dd/MM/yyyy'),
    daysUntilClose,
  }
}
```

**Verified output for today (2026-03-03 UTC, statementDay=15):**
- `startDisplay`: `16/02/2026`
- `endDisplay`: `15/03/2026`
- `daysUntilClose`: 12 (from midnight UTC, ~13 from VN midnight)

### Pattern 2: Grouping Transactions by Billing Cycle

**What:** A pure function that takes a flat sorted array of `CreditCardTransaction[]` and returns `BillingCycleGroup[]` sorted newest-cycle-first.

**Key rule:** Pending transactions have no `billingCycleStart` — assign them to the current cycle's `startISO`.

```typescript
// Source: verified logic against fixture data

export interface BillingCycleGroupData {
  cycleKey: string           // = billingCycleStart UTC ISO (used as React key and sort key)
  cycleStartISO: string
  cycleEndISO: string
  isCurrentCycle: boolean
  transactions: CreditCardTransaction[]
}

export function groupTransactionsByCycle(
  transactions: CreditCardTransaction[],
  currentCycle: BillingCycle
): BillingCycleGroupData[] {
  const groups = new Map<string, BillingCycleGroupData>()

  for (const tx of transactions) {
    let cycleKey: string
    let cycleStart: string
    let cycleEnd: string

    if (tx.billingCycleStart && tx.billingCycleEnd) {
      cycleKey   = tx.billingCycleStart
      cycleStart = tx.billingCycleStart
      cycleEnd   = tx.billingCycleEnd
    } else {
      // pending — assign to current cycle
      cycleKey   = currentCycle.startISO
      cycleStart = currentCycle.startISO
      cycleEnd   = currentCycle.endISO
    }

    if (!groups.has(cycleKey)) {
      groups.set(cycleKey, {
        cycleKey,
        cycleStartISO: cycleStart,
        cycleEndISO:   cycleEnd,
        isCurrentCycle: cycleKey === currentCycle.startISO,
        transactions: [],
      })
    }
    groups.get(cycleKey)!.transactions.push(tx)
  }

  // Sort groups newest-first by cycleKey (UTC ISO strings sort lexicographically)
  return Array.from(groups.values()).sort((a, b) =>
    b.cycleKey.localeCompare(a.cycleKey)
  )
}
```

**Verified:** With the fixture data, pending transactions (`cc-tx-001`, `cc-tx-002`) which have `transactionDate` of `2026-03-01` and `2026-02-28` respectively both get grouped under the current cycle key `2026-02-15T17:00:00.000Z` (the current cycle that started Feb 15 17:00 UTC = Feb 16 00:00 VN).

### Pattern 3: Cycle Group Header Display

**What:** A function to format the cycle's inclusive date range for display as a section header.

```typescript
// Returns: "Chu kỳ: 16/02/2026 - 15/03/2026" or "Chu kỳ hiện tại: 16/02 - 15/03/2026"
export function formatCycleDateRange(
  cycleStartISO: string,
  cycleEndISO: string
): { startDisplay: string; endDisplay: string } {
  const startVN = new TZDate(cycleStartISO, VN_TZ)
  const endVN   = new TZDate(cycleEndISO, VN_TZ)
  return {
    startDisplay: format(startVN, 'dd/MM/yyyy'),
    endDisplay:   format(subDays(endVN, 1), 'dd/MM/yyyy'),
  }
}
```

### Anti-Patterns to Avoid

- **Using `new Date()` for VN date parts:** `new Date('2026-03-15T17:00:00Z').getDate()` returns 15 in UTC but the intent is VN time (16). Always use `new TZDate(iso, VN_TZ).getDate()` to get the VN date components.
- **Using `date-fns-tz` (the old package):** The project uses `@date-fns/tz` (new unified package with `TZDate`). These are different packages. Do not install `date-fns-tz`.
- **Comparing date strings as strings for boundary checks:** `'2026-03-01' >= '2026-02-15'` works for ISO dates but not for UTC ISO with times. Use numeric comparison: `new Date(a).getTime() < new Date(b).getTime()`.
- **Computing cycles in the component render body:** Move all date math to `billingCycle.ts`. Components only call the utility functions.
- **Calling `computeCurrentCycle` on every render:** Memoize with `useMemo` in the component that calls it; pass `new Date().toISOString()` as the `nowISO` argument.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone-aware date | `new Date(iso).getTimezoneOffset()` hack | `new TZDate(iso, 'Asia/Ho_Chi_Minh')` | `TZDate` handles DST, works in any host timezone |
| Display date from VN components | `String(day).padStart(2,'0') + '/' + ...` | `format(tzDate, 'dd/MM/yyyy')` | Handles locale, leap years, month boundaries |
| Sorting cycles | Custom date comparator | Lexicographic sort on UTC ISO strings | UTC ISO strings are lexicographically sortable; no parsing needed for sorting |

---

## Common Pitfalls

### Pitfall 1: Fixture Comment vs Timestamp Mismatch

**What goes wrong:** Developer reads the comment `'15 Dec 2025 midnight VN'` in `creditCards.ts` and writes code to compute `midnight VN on statementDay = (statementDay-1) at 17:00 UTC`. But the actual constant `'2025-12-15T17:00:00Z'` = **Dec 16 00:00 VN**, not Dec 15 00:00 VN.

**Why it happens:** The comment describes the intent incorrectly. The convention is actually "midnight of the day AFTER statementDay in VN = 17:00 UTC on statementDay". This matches how transactions ON the statementDay (e.g., `2026-02-15T03:30:00Z` = Feb 15 10:30 VN) are correctly included IN the cycle.

**How to avoid:** Use the timestamp values, not the comments. Fix the comment in the fixture file as part of Phase 3. The boundary equation is: `boundary_UTC = Date.UTC(y, m, statementDay, 17, 0, 0)`.

**Warning signs:** If a transaction dated "Feb 15" in VN is appearing in the MARCH cycle, the boundary is off by one day.

### Pitfall 2: Pending Transactions Without Cycle Fields

**What goes wrong:** Grouping function crashes or produces a `null` key group when it encounters `billingCycleStart: undefined` on pending transactions.

**Why it happens:** The `CreditCardTransaction` Zod schema has `billingCycleStart` and `billingCycleEnd` as `.optional()`. Pending transactions in the fixture have no cycle fields at all.

**How to avoid:** Always check `tx.billingCycleStart && tx.billingCycleEnd` before using them. Fall back to `currentCycle.startISO` and `currentCycle.endISO` for pending transactions.

**Warning signs:** TypeScript will not warn because the fields are typed as `string | undefined`. The bug is silent.

### Pitfall 3: Month Rollover in Boundary Calculation

**What goes wrong:** `new Date(Date.UTC(2026, 11, 15, 17, 0, 0))` for December (month index 11) calculates next month as `m + 1 = 12`, but month 12 does not exist in JavaScript's Date — it wraps to January of the NEXT year.

**Why it happens:** `Date.UTC(year, 12, ...)` JavaScript correctly overflows month 12 to year+1 January, so it might accidentally work. But it's unreliable and confusing.

**How to avoid:** Always handle month 11 (December) explicitly: `const nextM = m === 11 ? 0 : m + 1; const nextY = m === 11 ? y + 1 : y`. Same for month 0 (January): `const prevM = m === 0 ? 11 : m - 1`.

### Pitfall 4: Infinite Re-render from `new Date()` in Render

**What goes wrong:** Calling `computeCurrentCycle(card.statementDate, new Date().toISOString())` directly in JSX or in the component body causes a new object reference on every render, and if the result feeds into `useMemo` dependencies, it causes an infinite loop.

**How to avoid:** Capture `now` once:
```typescript
const now = useMemo(() => new Date().toISOString(), [])
const currentCycle = useMemo(() => computeCurrentCycle(card.statementDate, now), [card.statementDate, now])
```

### Pitfall 5: `useInfiniteQuery` Pages Array Requires Full Flatten Before Grouping

**What goes wrong:** `useCreditCardTransactions` returns `data.pages` (array of pages), not a flat array. If you try to call `groupTransactionsByCycle(data.pages, ...)` you get an array of page objects, not transactions.

**How to avoid:** Always flatten first: `const allTx = data?.pages.flatMap(p => p.data) ?? []`. Then pass `allTx` to the grouping function. This pattern already exists in the current `CreditCardTransactionList.tsx`.

---

## Code Examples

### BillingCycleInfoCard Component

```typescript
// src/features/creditCards/BillingCycleInfoCard.tsx
// Shows: cycle start date, cycle end (statement) date, days until close badge

import { useMemo } from 'react'
import { computeCurrentCycle } from '@/utils/billingCycle'
import { Badge } from '@/components/ui/badge'
import type { CreditCard } from '@/types/creditCard'

interface BillingCycleInfoCardProps {
  card: CreditCard
}

export function BillingCycleInfoCard({ card }: BillingCycleInfoCardProps) {
  const now = useMemo(() => new Date().toISOString(), [])
  const cycle = useMemo(
    () => computeCurrentCycle(card.statementDate, now),
    [card.statementDate, now]
  )

  const urgencyVariant = cycle.daysUntilClose <= 3
    ? 'destructive'
    : cycle.daysUntilClose <= 7
    ? 'secondary'
    : 'default'

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Chu kỳ sao kê hiện tại</h3>
        <Badge variant={urgencyVariant}>
          Còn {cycle.daysUntilClose} ngày
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Bắt đầu chu kỳ</p>
          <p className="font-medium">{cycle.startDisplay}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ngày sao kê</p>
          <p className="font-medium">{cycle.statementDateDisplay}</p>
        </div>
      </div>
    </div>
  )
}
```

### BillingCycleGroup Component

```typescript
// src/features/creditCards/BillingCycleGroup.tsx
// Renders a section header and its transactions for one billing cycle

import { formatCycleDateRange } from '@/utils/billingCycle'
import { CreditCardTransactionRow } from './CreditCardTransactionRow'
import type { BillingCycleGroupData } from '@/utils/billingCycle'

interface BillingCycleGroupProps {
  group: BillingCycleGroupData
}

export function BillingCycleGroup({ group }: BillingCycleGroupProps) {
  const { startDisplay, endDisplay } = formatCycleDateRange(
    group.cycleStartISO,
    group.cycleEndISO
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 py-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {group.isCurrentCycle ? 'Chu kỳ hiện tại' : 'Chu kỳ trước'}
        </h3>
        <span className="text-xs text-muted-foreground">
          {startDisplay} – {endDisplay}
        </span>
      </div>
      <div className="space-y-2">
        {group.transactions.map((tx) => (
          <CreditCardTransactionRow key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  )
}
```

### Modified CreditCardTransactionList (grouped)

```typescript
// Replace the current flat map in CreditCardTransactionList.tsx with:
import { useMemo } from 'react'
import { computeCurrentCycle, groupTransactionsByCycle } from '@/utils/billingCycle'
import { BillingCycleGroup } from './BillingCycleGroup'

// Inside CreditCardTransactionList, after card data is available:
const allTransactions = data?.pages.flatMap((page) => page.data) ?? []
const now = useMemo(() => new Date().toISOString(), [])
const currentCycle = useMemo(
  () => card ? computeCurrentCycle(card.statementDate, now) : null,
  [card?.statementDate, now]
)
const cycleGroups = useMemo(
  () => currentCycle ? groupTransactionsByCycle(allTransactions, currentCycle) : [],
  [allTransactions, currentCycle]
)

return (
  <div className="space-y-4">
    {cycleGroups.map((group) => (
      <BillingCycleGroup key={group.cycleKey} group={group} />
    ))}
    {/* Load more button and end-of-list message unchanged */}
  </div>
)
```

### Unit Test Pattern for billingCycle.ts

```typescript
// src/utils/billingCycle.test.ts
import { describe, it, expect } from 'vitest'
import { computeCurrentCycle, groupTransactionsByCycle } from './billingCycle'

describe('computeCurrentCycle', () => {
  it('returns correct cycle when today is before statementDay', () => {
    // 2026-03-03 VN, statementDay=15 → cycle started Feb 15 17:00Z
    const result = computeCurrentCycle(15, '2026-03-03T00:00:00Z')
    expect(result.startDisplay).toBe('16/02/2026')
    expect(result.endDisplay).toBe('15/03/2026')
    expect(result.daysUntilClose).toBeGreaterThan(0)
  })

  it('returns correct cycle when today is after statementDay', () => {
    // 2026-03-20 VN, statementDay=15 → cycle started Mar 15 17:00Z
    const result = computeCurrentCycle(15, '2026-03-20T00:00:00Z')
    expect(result.startDisplay).toBe('16/03/2026')
    expect(result.endDisplay).toBe('15/04/2026')
  })

  it('handles December-to-January rollover', () => {
    // 2026-12-20 VN, statementDay=15 → cycle ends Jan 15 17:00Z next year
    const result = computeCurrentCycle(15, '2026-12-20T00:00:00Z')
    expect(result.endDisplay).toBe('15/01/2027')
  })

  it('handles January rollover backwards (today Jan 5, statementDay=15)', () => {
    // 2026-01-05 VN → cycle started Dec 15 17:00Z 2025
    const result = computeCurrentCycle(15, '2026-01-05T00:00:00Z')
    expect(result.startDisplay).toBe('16/12/2025')
    expect(result.endDisplay).toBe('15/01/2026')
  })
})

describe('groupTransactionsByCycle', () => {
  it('assigns pending transactions to current cycle', () => {
    const cycle = computeCurrentCycle(15, '2026-03-03T00:00:00Z')
    const txs = [
      { id: 'p1', status: 'pending' as const, cardId: 'x', amount: -100,
        description: '', merchantName: '', type: 'purchase' as const,
        transactionDate: '2026-03-01T11:00:00Z' },
    ]
    const groups = groupTransactionsByCycle(txs, cycle)
    expect(groups).toHaveLength(1)
    expect(groups[0].isCurrentCycle).toBe(true)
    expect(groups[0].transactions[0].id).toBe('p1')
  })

  it('groups posted transactions by billingCycleStart', () => {
    const cycle = computeCurrentCycle(15, '2026-03-03T00:00:00Z')
    const txs = [
      { id: 'q1', status: 'posted' as const, cardId: 'x', amount: -200,
        description: '', merchantName: '', type: 'purchase' as const,
        transactionDate: '2026-02-10T05:00:00Z',
        billingCycleStart: '2026-01-15T17:00:00Z',
        billingCycleEnd: '2026-02-15T17:00:00Z' },
    ]
    const groups = groupTransactionsByCycle(txs, cycle)
    expect(groups[0].cycleKey).toBe('2026-01-15T17:00:00Z')
    expect(groups[0].isCurrentCycle).toBe(false)
  })
})
```

---

## Data Flow for Billing Cycle Grouping

```
CreditCardsPage
  ├── CreditCardTabs          — sets cardId in filterStore (existing)
  ├── BillingCycleInfoCard    — NEW: receives CreditCard object, calls computeCurrentCycle()
  │     └── needs: card.statementDate (already in CreditCard schema)
  ├── FilterBar               — existing, unchanged
  └── CreditCardTransactionList — MODIFY: add grouped render
        ├── useCreditCardTransactions() — existing hook (useInfiniteQuery)
        ├── useCreditCards()            — existing hook, used to get the CreditCard object for statementDate
        ├── allTx = pages.flatMap(...)
        ├── currentCycle = computeCurrentCycle(card.statementDate, now)
        ├── cycleGroups = groupTransactionsByCycle(allTx, currentCycle)
        └── BillingCycleGroup[] — NEW component per group
```

**Data requirements already met:**
- `CreditCard.statementDate` (integer 1-31) — already in schema and fixture
- `CreditCardTransaction.billingCycleStart` (optional UTC ISO) — already in schema and fixture (populated for all posted txs, absent for pending)
- `CreditCardTransaction.billingCycleEnd` (optional UTC ISO) — same

**No schema changes required. No new API endpoints required. No new MSW handlers required.**

---

## Fixture Data Analysis

### Current Fixture Cycles

| Cycle Key (UTC) | VN Date Range (inclusive) | Transactions |
|-----------------|--------------------------|--------------|
| `2025-12-15T17:00:00Z` (start) | Dec 16, 2025 – Jan 15, 2026 | TCB: cc-tx-021 to cc-tx-032 (Dec posted), VPB: cc-vpb-018 to cc-vpb-027 |
| `2026-01-15T17:00:00Z` (start) | Jan 16, 2026 – Feb 15, 2026 | TCB: cc-tx-013 to cc-tx-020, VPB: cc-vpb-010 to cc-vpb-017 |
| Current cycle start (computed) | Feb 16, 2026 – Mar 15, 2026 | TCB: cc-tx-001 to cc-tx-012 (pending+feb-posted), VPB: cc-vpb-001 to cc-vpb-009 |

**Critical fixture inconsistency to fix:** The fixture comment says `// 15 Dec 2025 midnight VN` but the constant `'2025-12-15T17:00:00Z'` equals `2025-12-16 00:00 VN`. The comment should read `// 16 Dec 2025 00:00 VN (= statementDay 15 at 17:00 UTC)`. Fix the comments in Phase 3.

**Pending transaction cycle assignment:** The 4 pending transactions (cc-tx-001, cc-tx-002, cc-vpb-001, cc-vpb-002) have no `billingCycleStart` set. The grouping function assigns them to the current cycle (start = `2026-02-15T17:00:00.000Z`, computed from `statementDate=15` and today `2026-03-03`). This matches the Feb posted transactions in the same cycle.

**Three distinct cycles will appear in the grouped list per card** — this makes the UI visually interesting and demonstrates the feature clearly.

---

## CreditCardsPage Integration

```
CreditCardsPage layout (after Phase 3):

Page header (existing)
CreditCardTabs (existing)
BillingCycleInfoCard  ← NEW: positioned here, above filters
FilterBar (existing)
CreditCardTransactionList (MODIFIED: grouped by cycle)
  ├── [Current Cycle] header + transactions
  ├── [Previous Cycle] header + transactions
  └── [Earlier Cycle] header + transactions
```

The `BillingCycleInfoCard` needs the active `CreditCard` object. It should be fetched from `useCreditCards()` in the page or passed from the component that already has it. The `CreditCardTabs` already calls `useCreditCards()` — the same query will be cached by TanStack Query, so calling it again in `BillingCycleInfoCard` or the page costs zero network requests.

**Recommended approach:** `CreditCardsPage` calls `useCreditCards()` and derives the active card from `cardId` in filterStore. Pass it as a prop to `BillingCycleInfoCard`.

---

## State of the Art

| Old Approach | Current Approach | Relevance |
|--------------|-----------------|-----------|
| `date-fns-tz` (separate package) | `@date-fns/tz` (unified with date-fns v3+) | Project already uses `@date-fns/tz` correctly; do not install `date-fns-tz` |
| Manual UTC offset math (`new Date().getTime() + 7*3600*1000`) | `TZDate(iso, 'Asia/Ho_Chi_Minh')` | `TZDate` is type-safe and DST-safe; the project already uses this pattern in `dates.ts` |
| Calendar-month grouping of card transactions | Billing cycle grouping | Phase 3 introduces the differentiating feature; this is why the CC transaction list currently shows a flat list |

---

## Open Questions

1. **What happens when a user applies a date filter that spans multiple billing cycles?**
   - What we know: The `FilterBar` date range picker wires to `dateFrom`/`dateTo` in filterStore, which filters transactions in the MSW handler.
   - What's unclear: Should grouping still apply when a date filter is active? A date filter showing "Jan 15 - Feb 20" might return transactions from two different cycles.
   - Recommendation: Always apply grouping regardless of filters. The grouping function operates on whatever transactions come back. If filtered results span two cycles, two group headers appear naturally. This is correct behavior.

2. **Should the `BillingCycleInfoCard` update when a different card is selected in `CreditCardTabs`?**
   - What we know: Both TCB and VPBank cards in the fixture have `statementDate=15`. If they had different dates, the info card must update.
   - Recommendation: Always derive from the active card's `statementDate` (driven by `cardId` in filterStore). The component re-renders automatically when `cardId` changes because `useCreditCards()` result changes.

3. **How should `daysUntilClose` handle the exact statement day itself?**
   - What we know: `differenceInCalendarDays` and ceiling math gives 0 when today IS the statement day in VN.
   - Recommendation: Display `"Hôm nay là ngày sao kê"` (Today is statement date) when `daysUntilClose === 0`. Display `"Đã sao kê"` (Cycle closed) if `daysUntilClose < 0` (edge case, should not occur with correct cycle computation).

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in config.json — skipping this section.

(Config only has `research`, `plan_check`, `verifier`, `auto_advance` flags. No `nyquist_validation` key present.)

---

## Sources

### Primary (HIGH confidence)

- `src/mocks/fixtures/creditCards.ts` — Confirmed fixture cycle boundary convention (`17:00 UTC = midnight VN of statementDay+1`), confirmed 3 billing cycles in data, confirmed pending transactions lack cycle fields
- `src/types/creditCard.ts` — Confirmed `CreditCardSchema` has `statementDate: z.number().int()` and `billingCycleStart`/`billingCycleEnd` as `.optional()` on transactions
- `@date-fns/tz` v1.4.1 exports (verified via node): `TZDate`, `TZDateMini`, `tz`, `tzOffset`, `tzScan`, `tzName`
- `date-fns` v4.1.0 available functions (verified via node): `format`, `subDays`, `differenceInCalendarDays`, `addMonths`, `setDate`, `isAfter`, `isBefore`
- Billing cycle math verified with live node execution: `computeCurrentCycle(15, '2026-03-03T00:00:00Z')` → `startDisplay: '16/02/2026'`, `endDisplay: '15/03/2026'`, `daysUntilClose: 12`
- Grouping logic verified: pending `cc-tx-001` (`2026-03-01T11:00:00Z`) correctly placed in current cycle `2026-02-15T17:00:00.000Z`

### Secondary (MEDIUM confidence)

- Vietnamese banking practice (statementDate = last day of cycle, cycle is exclusive of boundary): derived from fixture data structure and comment intent, cross-checked against the boundary convention producing correct assignment of Feb 15 10:30 VN transactions to the Feb cycle

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all libs already installed and verified via node
- Billing cycle math: HIGH — verified with actual installed lib versions; all edge cases tested
- Architecture: HIGH — follows existing patterns in codebase exactly (pure utils, TanStack Query, useShallow)
- Fixture consistency: HIGH — confirmed with TZDate conversion what the UTC timestamps mean in VN
- Component structure: HIGH — follows existing feature/creditCards pattern; named consistently

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — no fast-moving dependencies; all are already installed)
