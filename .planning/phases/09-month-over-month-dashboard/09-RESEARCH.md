# Phase 9: Month-over-Month Dashboard - Research

**Researched:** 2026-03-08
**Domain:** Dashboard stat card enhancements, month boundary calculations in Vietnam timezone (UTC+7), delta percentage computation
**Confidence:** HIGH

---

## Summary

Phase 9 enhances the existing dashboard stat cards (Income and Expense) to display month-over-month delta trends. Each stat card now shows a delta badge (e.g., "↑12% vs tháng trước") comparing the current selected month to the previous month. The delta is hidden and replaced with "Chưa đủ dữ liệu" (insufficient data) when the current month has fewer than 5 transactions, preventing misleading early-month snapshots.

**Critical design constraints:**
1. **No extra API calls** — delta calculated from existing dashboard data structure
2. **Month boundaries use Vietnam UTC+7 timezone**, not browser/browser timezone — established in Phase 3 with `TZDate` from `@date-fns/tz`
3. **Delta only shown with >= 5 transactions** — requirement DASH-V2-02 prevents misleading trends on sparse data
4. **Re-uses existing dashboardStore date range** — same `dateFrom`/`dateTo` that drives primary stat cards

**Implementation approach:**
The dashboard currently calls `/api/dashboard/stats?dateFrom=X&dateTo=Y` once per month period. For delta calculation:
1. **Determine current month** from `dashboardStore.dateFrom`/`dateTo` (or use full calendar month if date range is null)
2. **Calculate previous month boundaries** in UTC+7 (subtract 1 month, preserve day-of-month if possible; handle year boundaries)
3. **Fetch stats for previous month** using existing `getDashboardStats()` service
4. **Compute delta** = ((current month total - previous month total) / previous month total) * 100, formatted as ±X%
5. **Pass delta to StatCard component** as optional prop; StatCard renders delta badge OR "Chưa đủ dữ liệu" based on transaction count threshold

The existing `DashboardPage` already has the pattern for this: it fetches data via `useDashboardStats()` hook, which reads `dashboardStore.dateFrom`/`dateTo`. Phase 9 extends this to make a second parallel query for the previous month period.

**Primary recommendation:**
1. Create `calculateMonthDelta(currentStats: DashboardStats, previousStats: DashboardStats): number` utility function in `utils/dates.ts` or new `utils/dashboard.ts`
2. Create `getPreviousMonthDateRange(dateFrom: string | null, dateTo: string | null): { prevFrom: string; prevTo: string }` utility (handles month navigation in UTC+7)
3. Extend `useDashboardStats()` hook to fetch both current AND previous month stats in parallel using `useQueries()` or separate query + custom hook logic
4. Extend `StatCard` props to accept optional `delta?: number | null` and `deltaLoading?: boolean`
5. Update `StatCard` rendering to show delta badge OR "Chưa đủ dữ liệu" based on `transactionCount >= 5`
6. Add delta badge styles (trending-up green, trending-down red) using existing Tailwind color palette

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-V2-01 | Dashboard income/expense stat cards show a delta vs previous month (↑12% vs tháng trước) | Delta calculated from parallel `getDashboardStats()` call for previous month period |
| DASH-V2-02 | Delta hidden and replaced with "Chưa đủ dữ liệu" when current month < 5 transactions | StatCard checks `transactionCount < 5` to suppress delta display |
</phase_requirements>

---

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @tanstack/react-query | ^5.90 | Parallel query fetching for current + previous month stats | Installed — no changes needed; `useQueries()` or custom hook composition used |
| date-fns | ^3.3.1 | Date arithmetic for month boundary calculation | Installed; existing `format()` used in Phase 3+6 |
| @date-fns/tz | ^3.3.1 | Vietnam timezone (UTC+7) date parsing; TZDate for month calculations | Installed; used in `dates.ts` for existing billing cycle logic |
| zustand | ^5.0 | Read `dashboardStore` for date range that defines "current month" | Installed; already integrated with `useDashboardDateRange()` hook |

### No New npm Dependencies

All phase requirements satisfied with existing stack. Month boundary logic uses `date-fns` (already available) + `TZDate` (already in use).

---

## Architecture Patterns

### Recommended Project Structure for Phase 9

```
src/
  utils/
    dates.ts                           # ADD: calculateMonthDelta(), getPreviousMonthDateRange()
    dates.test.ts                      # ADD: Tests for month boundary edge cases (Feb→Jan, Dec→Nov, year boundary)
  hooks/
    useDashboardStats.ts               # MODIFY: Extend to fetch previous month stats in parallel
    useDashboardStats.test.ts          # ADD: Tests for two-month query behavior
  features/
    dashboard/
      StatCard.tsx                     # MODIFY: Accept delta prop, render delta badge or "Chưa đủ dữ liệu"
      DashboardPage.tsx                # MODIFY: Pass delta to StatCard components (prop drilling or context)
      StatCard.test.tsx                # ADD: Test delta badge rendering and threshold logic
      (new file optional: DeltaBadge.tsx for reusable delta badge component)
```

### Pattern 1: Month-over-Month Delta Calculation

**What:** Helper function to calculate percentage change between two monthly stats snapshots.

**When to use:** Called when comparing current month stats to previous month stats.

**Example:**

```typescript
// Source: Project pattern (to be implemented in utils/dates.ts)

/**
 * Calculate month-over-month percentage delta.
 * @param currentAmount - Total for current month
 * @param previousAmount - Total for previous month
 * @returns Percentage change (e.g., 12 for +12%, -8 for -8%), or null if previous was 0 or negative
 */
export function calculateMonthDelta(currentAmount: number, previousAmount: number): number | null {
  if (previousAmount <= 0) return null  // Cannot calculate % change from zero or negative baseline
  return Math.round(((currentAmount - previousAmount) / previousAmount) * 100)
}

// Usage in StatCard:
const delta = calculateMonthDelta(data.totalIncome, previousMonthData.totalIncome)
const deltaDisplay = delta !== null && data.transactionCount >= 5 ? `${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}%` : null
```

### Pattern 2: Previous Month Date Range (Vietnam UTC+7)

**What:** Calculate the first and last day of the previous calendar month in Vietnam timezone.

**When to use:** Determining the date range for querying previous month stats.

**Important:** Must handle:
- Year boundaries (Jan → Dec of previous year)
- Month-end edge cases (e.g., Jan 31 → Dec 31, Feb 28/29)
- UTC+7 timezone boundaries (not browser timezone)

**Example:**

```typescript
// Source: Project pattern (to be implemented in utils/dates.ts)
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { TZDate } from '@date-fns/tz'

const VN_TZ = 'Asia/Ho_Chi_Minh'

/**
 * Given a date range (or null for "current month"), return the previous month's date range.
 * All calculations are in Vietnam timezone (UTC+7).
 * @param dateFrom - ISO string "YYYY-MM-DD" or null (implies calendar month)
 * @param dateTo - ISO string "YYYY-MM-DD" or null
 * @returns { prevFrom: "YYYY-MM-DD", prevTo: "YYYY-MM-DD" }
 */
export function getPreviousMonthDateRange(
  dateFrom: string | null,
  dateTo: string | null
): { prevFrom: string; prevTo: string } {
  let refDate: TZDate

  if (dateFrom) {
    // User has selected a date range; use the start date to determine "current month"
    refDate = new TZDate(dateFrom, VN_TZ)
  } else {
    // No date range selected; use today's date in Vietnam time
    refDate = new TZDate(new Date().toISOString(), VN_TZ)
  }

  // Go back one month
  const prevMonthDate = subMonths(refDate, 1)

  // Get first and last day of previous month
  const prevStart = startOfMonth(prevMonthDate)
  const prevEnd = endOfMonth(prevMonthDate)

  // Format as ISO date strings (YYYY-MM-DD)
  return {
    prevFrom: format(prevStart, 'yyyy-MM-dd'),
    prevTo: format(prevEnd, 'yyyy-MM-dd'),
  }
}
```

### Pattern 3: Extended Dashboard Hook with Parallel Queries

**What:** Fetch both current month and previous month stats in parallel.

**When to use:** Dashboard page mount / when date range changes in dashboardStore.

**Design decision:** Use `useQueries()` from TanStack Query for parallel independent queries, OR use separate `useQuery()` calls with a custom hook wrapper.

**Example (using useQueries):**

```typescript
// Source: Project pattern (to be implemented in hooks/useDashboardStats.ts)
import { useQueries } from '@tanstack/react-query'
import { useDashboardDateRange } from '@/stores/dashboardStore'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()
  const { prevFrom, prevTo } = getPreviousMonthDateRange(dateFrom, dateTo)

  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboardStats', { dateFrom, dateTo }],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }],
        queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }),
        staleTime: 1000 * 60 * 5,
      },
    ],
  })

  const [currentQuery, previousQuery] = results

  // Combine into a single result object for backward compatibility with DashboardPage
  return {
    data: currentQuery.data,
    previousData: previousQuery.data,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
    refetch: () => {
      currentQuery.refetch()
      previousQuery.refetch()
    },
  }
}
```

### Pattern 4: StatCard Delta Badge Rendering

**What:** Extend StatCard to display delta badge when conditions are met.

**When to use:** Inside StatCard component, after data loads.

**Conditions to display delta:**
1. `delta` prop is not null
2. `transactionCount >= 5` (DASH-V2-02 requirement)

**Example:**

```typescript
// Source: Project pattern (to be implemented in features/dashboard/StatCard.tsx)

interface StatCardProps {
  variant: 'income' | 'expense'
  amount: number
  transactionCount: number
  delta?: number | null  // NEW: month-over-month percentage change
  deltaLoading?: boolean // NEW: true while previous month data is loading
  isError?: boolean
  onRetry?: () => void
  children?: ReactNode
}

export function StatCard({
  variant,
  amount,
  transactionCount,
  delta,
  deltaLoading,
  isError,
  onRetry,
  children
}: StatCardProps) {
  const isIncome = variant === 'income'
  const Icon = isIncome ? TrendingUp : TrendingDown
  const label = isIncome ? 'Tổng thu' : 'Tổng chi'
  const colorClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

  // Determine delta display
  const shouldShowDelta = delta !== null && transactionCount >= 5
  const deltaDisplay = shouldShowDelta ? (
    <div className="mt-2 flex items-center gap-1 text-xs">
      <span className={delta > 0 ? 'text-emerald-600' : 'text-red-600'}>
        {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}% vs tháng trước
      </span>
    </div>
  ) : deltaLoading ? (
    <div className="mt-2 text-xs text-muted-foreground">Đang tính...</div>
  ) : (
    <div className="mt-2 text-xs text-muted-foreground">Chưa đủ dữ liệu</div>
  )

  return (
    <Card className="min-h-[140px] transition-colors duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="heading-label text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </CardHeader>
      <CardContent className="card-gap flex flex-col">
        {isError ? (
          <div className="space-y-2">
            <p className="body-sm text-muted-foreground">Không thể tải dữ liệu</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="touch-target">
                Thử lại
              </Button>
            )}
          </div>
        ) : transactionCount === 0 ? (
          <div>
            <p className={`heading-h1 tabular-nums ${colorClass}`}>{formatVND(0)}</p>
            <p className="body-sm text-muted-foreground mt-1">Không có giao dịch trong kỳ này</p>
          </div>
        ) : (
          <div>
            <p className={`heading-h1 tabular-nums ${colorClass}`}>{formatVND(amount)}</p>
            {children}
            {deltaDisplay}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### Anti-Patterns to Avoid

- **Making extra API calls for delta data**: ❌ Phase requirement explicitly states "No extra API calls". Reuse existing `/api/dashboard/stats` endpoint with different date ranges. Single fetch per period (not one call for current + one for previous + separate delta endpoint).
- **Using browser timezone for month boundaries**: ❌ Must use Vietnam UTC+7 timezone (established in Phase 3). Browser timezone can differ; if user is in London and viewing Vietnam transaction data, month boundaries should still be UTC+7.
- **Showing delta for sparse data**: ❌ DASH-V2-02 requires hiding delta when `transactionCount < 5`. Show "Chưa đủ dữ liệu" instead.
- **Hardcoding "current month" without date range awareness**: ❌ If user has selected a custom date range in dashboardStore, use that to determine "current month". If null (default), use calendar month of today.
- **Calculating delta before both queries complete**: ❌ Both current month and previous month stats must be fully loaded before computing delta. Use `isLoading` from both queries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic (add/subtract months) | Custom month subtraction logic | `date-fns` `subMonths()`, `startOfMonth()`, `endOfMonth()` | Already installed; handles edge cases (Feb 29, year boundaries, timezone). Custom logic is fragile. |
| Timezone-aware date parsing | Naive `new Date()` parsing | `TZDate` from `@date-fns/tz` | Established pattern in Phase 3 billing cycle code. Native Date parses UTC-only; TZDate handles Asia/Ho_Chi_Minh (UTC+7) correctly. |
| Parallel query orchestration | Manual `useState` + multiple `useQuery` calls | `useQueries()` from `@tanstack/react-query` | Built-in query deduplication, loading state management, refetch coordination. Custom logic requires tracking 2+ independent loading states and refetch logic. |
| Percentage delta calculation | Custom formula | Simple utility function (see Pattern 1) | Not complex enough to justify a library, but edge case handling (zero/negative previous amount) is easy to get wrong. |

---

## Common Pitfalls

### Pitfall 1: Month Boundary Edge Cases (Feb → Jan, Year Rollover)

**What goes wrong:** Using simple date arithmetic without timezone or month-end awareness.

Example bug:
```typescript
// WRONG: subtract 30 days
const prevDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)
// If current is Feb 29, previous is ~Jan 30 (not Jan 1–31, may miss Jan 31 transactions)
```

**Why it happens:** Manual date math ignores calendar structure. Feb has 28/29 days, so "30 days ago" lands on wrong month.

**How to avoid:**
1. Use `date-fns` `subMonths(date, 1)` to go back one month (preserves day-of-month when possible)
2. Wrap with `startOfMonth()` and `endOfMonth()` to get first and last day
3. Always use `TZDate` from `@date-fns/tz` for Vietnam timezone, not native Date

**Warning signs:**
- Tests fail for Jan/Feb/Dec transitions
- Month boundary shows skipped or duplicate transactions when toggling date range
- "Previous month" transactions appear on wrong side of dashboard (in current month stats instead of previous)

### Pitfall 2: Using Browser Timezone Instead of Vietnam UTC+7

**What goes wrong:** Assuming user's local timezone is Vietnam (UTC+7), leading to wrong date boundaries.

Example bug:
```typescript
// WRONG: user is in London (UTC), "today" in browser is Mar 8 23:00 UTC = Mar 9 06:00 VN
// But we calculate month boundaries using browser's midnight, which is Mar 8 00:00 UTC = Mar 8 07:00 VN
// Result: first few hours of March 9 VN get grouped into "February"
```

**Why it happens:** Developers assume user is in same timezone as data. "Today" in browser (via `new Date()`) is interpreted as browser time, not data time.

**How to avoid:**
1. All month boundary calculations must use `TZDate(isoString, 'Asia/Ho_Chi_Minh')`
2. If calculating "today", use `new TZDate(new Date().toISOString(), VN_TZ)` not `new Date()`
3. Test with browser set to different timezone (DevTools can mock this)

**Warning signs:**
- Dashboard shows inconsistent month boundaries depending on user's location
- Transaction appears in different month on dashboard vs on transaction list (one uses browser TZ, other uses UTC+7)
- Off-by-one-day errors that only appear for users not in Vietnam

### Pitfall 3: Showing Delta When Data is Insufficient

**What goes wrong:** Calculating and displaying delta when current month has < 5 transactions, showing misleading trends.

Example:
- User looks at dashboard on March 2 with 3 transactions so far
- Dashboard shows "↑200% vs tháng trước" (because March is now at 3M, Feb had 1M)
- User thinks March is a spending spike; actually just too early in month to tell

**Why it happens:** Requirement DASH-V2-02 is treated as "optional nice-to-have" instead of **must-enforce threshold**.

**How to avoid:**
1. Check `transactionCount >= 5` BEFORE rendering delta badge
2. If false, show "Chưa đủ dữ liệu" instead (Vietnamese for "insufficient data")
3. Test the threshold: 4 transactions → no delta, 5+ → show delta

**Warning signs:**
- Beta testers complain dashboard trends are misleading early in month
- Threshold logic is conditional in only some code paths (e.g., hidden in one view, shown in another)
- "Chưa đủ dữ liệu" message never appears in testing

### Pitfall 4: Parallel Query Loading State Confusion

**What goes wrong:** Showing "loading" spinner while both current + previous queries load, but spinner disappears prematurely when current finishes but previous still pending.

Example bug:
```typescript
// WRONG: only check current query loading
const { isLoading } = useDashboardStats()  // true while both queries load, false when current finishes
// Result: stat card appears, delta shows as "Chưa đủ dữ liệu" (delta not yet calculated), flickers to delta value when previous query finishes
```

**Why it happens:** Not tracking loading state for both queries independently. Mixing `useQuery()` calls with different loading timings.

**How to avoid:**
1. Use `useQueries()` to fetch both periods in parallel and track both loading states
2. Hook should return `isLoading: currentLoading || previousLoading` so spinner shows until BOTH complete
3. Pass `deltaLoading: previousLoading && !isLoading` to StatCard (previous still loading after current done)

**Warning signs:**
- StatCard flickers between "Chưa đủ dữ liệu" and delta percentage
- Delta only appears after a delay, not with main data load
- Refetch button sometimes doesn't refetch previous month data

### Pitfall 5: Delta Calculated Before Both Queries Loaded

**What goes wrong:** Computing `calculateMonthDelta()` using partially loaded data (current loaded, previous still pending).

Example:
```typescript
// WRONG: in StatCard, compute delta immediately without checking both queries are done
const delta = calculateMonthDelta(data.totalIncome, previousData?.totalIncome ?? 0)
// If previousData is undefined, delta calculation uses 0, resulting in "currentAmount / 0 → null"
```

**Why it happens:** Passing `delta` prop to StatCard before previous query completes; StatCard renders with incomplete data.

**How to avoid:**
1. In hook, combine both query results and only return delta when both queries are fully loaded
2. In StatCard, only render delta when both `data` and `previousData` are present AND `!isLoading`
3. Test: verify delta is null/undefined while previous query is pending, then updates to correct value when loaded

**Warning signs:**
- Delta shows "undefined" or "NaN" initially, then corrects to correct value
- Test failures when querying both months simultaneously
- Console errors like "Cannot read property 'totalIncome' of undefined"

---

## Code Examples

Verified patterns from existing project codebase:

### Month Boundary Calculation with date-fns + TZDate

```typescript
// Source: Project pattern (adapted from Phase 3 billingCycle.ts + dates.ts)
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { TZDate } from '@date-fns/tz'

const VN_TZ = 'Asia/Ho_Chi_Minh'

export function getPreviousMonthDateRange(
  dateFrom: string | null,
  dateTo: string | null
): { prevFrom: string; prevTo: string } {
  let refDate: TZDate

  // Use provided dateFrom as reference, or today in Vietnam time if no range selected
  if (dateFrom) {
    refDate = new TZDate(dateFrom, VN_TZ)
  } else {
    refDate = new TZDate(new Date().toISOString(), VN_TZ)
  }

  // Subtract one month and get month boundaries
  const prevMonthDate = subMonths(refDate, 1)
  const prevStart = startOfMonth(prevMonthDate)
  const prevEnd = endOfMonth(prevMonthDate)

  return {
    prevFrom: format(prevStart, 'yyyy-MM-dd'),
    prevTo: format(prevEnd, 'yyyy-MM-dd'),
  }
}
```

### Parallel Query Hook (TanStack Query Pattern)

```typescript
// Source: Project pattern (to be implemented; follows useDashboardStats.ts)
import { useQueries } from '@tanstack/react-query'
import { getDashboardStats } from '@/services/dashboard'
import { useDashboardDateRange } from '@/stores/dashboardStore'
import { getPreviousMonthDateRange, calculateMonthDelta } from '@/utils/dates'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()
  const { prevFrom, prevTo } = getPreviousMonthDateRange(dateFrom, dateTo)

  const results = useQueries({
    queries: [
      {
        queryKey: ['dashboardStats', { dateFrom, dateTo }],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }],
        queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }),
        staleTime: 1000 * 60 * 5,
      },
    ],
  })

  const [currentQuery, previousQuery] = results

  // Compute deltas only when both queries are loaded
  const currentData = currentQuery.data
  const previousData = previousQuery.data
  const isLoading = currentQuery.isLoading || previousQuery.isLoading
  const isError = currentQuery.isError || previousQuery.isError

  const incomeDelta =
    currentData && previousData ? calculateMonthDelta(currentData.totalIncome, previousData.totalIncome) : null
  const expenseDelta =
    currentData && previousData ? calculateMonthDelta(currentData.totalExpense, previousData.totalExpense) : null

  return {
    data: currentData,
    incomeDelta,
    expenseDelta,
    deltaLoading: previousQuery.isLoading && !currentQuery.isLoading,
    isLoading,
    isError,
    refetch: () => {
      currentQuery.refetch()
      previousQuery.refetch()
    },
  }
}
```

### Delta Badge Component

```typescript
// Source: Project pattern (new component for Phase 9)
interface DeltaBadgeProps {
  delta: number | null
  transactionCount: number
  isLoading?: boolean
  variant?: 'income' | 'expense'
}

export function DeltaBadge({ delta, transactionCount, isLoading, variant = 'expense' }: DeltaBadgeProps) {
  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Đang tính...</div>
  }

  if (delta === null || transactionCount < 5) {
    return <div className="text-xs text-muted-foreground">Chưa đủ dữ liệu</div>
  }

  const isPositive = delta > 0
  const colorClass = variant === 'income'
    ? isPositive ? 'text-emerald-600' : 'text-red-600'
    : isPositive ? 'text-red-600' : 'text-emerald-600'  // expense: up is bad, down is good

  return (
    <div className={`text-xs ${colorClass}`}>
      {isPositive ? '↑' : '↓'}{Math.abs(delta)}% vs tháng trước
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `/api/dashboard/stats` call per month | Parallel queries for current + previous month (this phase) | Phase 9 | Client-side delta computation; no backend changes needed; stateless comparison |
| Native `Date` for timezone logic | `TZDate` from `@date-fns/tz` for Vietnam UTC+7 | Phase 3 | Correct month boundaries regardless of user location; prevents timezone-related bugs |
| Manual percentage math | Utility function `calculateMonthDelta()` with edge case handling | Phase 9 | Consistent delta calculation; handles zero/negative baselines correctly |

**Deprecated/outdated:**
- None — this is new functionality building on established patterns (TZDate, useQuery, Zustand store)

---

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library |
| Config file | vitest.config.ts + test-setup.ts |
| Quick run command | `npm test -- src/utils/dates.test.ts --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-V2-01 | Stat card renders delta badge when current month >= 5 transactions | unit | `npm test -- src/features/dashboard/StatCard.test.ts --run -t "renders delta badge"` | ❌ Wave 0 |
| DASH-V2-01 | Delta calculation is accurate (e.g., 100→150 = +50%) | unit | `npm test -- src/utils/dates.test.ts --run -t "calculateMonthDelta"` | ❌ Wave 0 |
| DASH-V2-01 | Previous month date range is calculated correctly (Jan→Dec, Feb→Jan, Dec→Nov) | unit | `npm test -- src/utils/dates.test.ts --run -t "getPreviousMonthDateRange"` | ❌ Wave 0 |
| DASH-V2-02 | Stat card shows "Chưa đủ dữ liệu" when current month has 0–4 transactions | unit | `npm test -- src/features/dashboard/StatCard.test.ts --run -t "insufficient data"` | ❌ Wave 0 |
| DASH-V2-02 | Stat card hides delta when transactionCount < 5 | unit | `npm test -- src/features/dashboard/StatCard.test.ts --run -t "hides delta"` | ❌ Wave 0 |
| Both | DashboardPage fetches both current and previous month data (parallel queries) | integration | `npm test -- src/pages/DashboardPage.test.tsx --run -t "month-over-month"` | ✅ Exists; add month-over-month test case |
| Both | Delta displayed correctly in rendered dashboard | integration | `npm test -- src/pages/DashboardPage.test.tsx --run -t "delta badge"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/utils/dates.test.ts src/hooks/useDashboardStats.test.ts --run`
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/utils/dates.test.ts` — Add tests for `calculateMonthDelta()` (edge cases: zero baseline, negative delta) and `getPreviousMonthDateRange()` (year boundary, Feb→Jan)
- [ ] `src/hooks/useDashboardStats.test.ts` — Add tests for parallel query behavior; verify both current + previous month queries are made
- [ ] `src/features/dashboard/StatCard.test.tsx` — Add tests for delta badge rendering; verify "Chưa đủ dữ liệu" shows when transactionCount < 5
- [ ] `src/pages/DashboardPage.test.tsx` — Add integration test for month-over-month delta display end-to-end

---

## Sources

### Primary (HIGH confidence)

- **Project codebase (dates.ts, dashboardStore.ts, handlers.ts)**
  - Vietnam timezone (UTC+7) established in Phase 3 via `TZDate` + `@date-fns/tz`
  - `useDashboardStats()` hook fetches via `getDashboardStats()` service
  - Dashboard date range from `useDashboardDateRange()` store selector
  - Existing test patterns (DashboardPage.test.tsx) verify component behavior

- **date-fns v3.3.1 official docs**
  - `subMonths(date, n)` for month arithmetic
  - `startOfMonth()`, `endOfMonth()` for month boundaries
  - No deprecations in v3.x that affect this use case

- **@date-fns/tz v3.3.1**
  - `TZDate` class for timezone-aware parsing
  - Established use in Phase 3 billing cycle logic

- **TanStack Query v5.90 official docs**
  - `useQueries()` for parallel independent query fetching
  - Query key structure for auto-refetch on dependency change
  - Already used throughout project (FilterStore + TanStack Query integration)

### Secondary (MEDIUM confidence)

- **Project decisions documented in STATE.md**
  - Month boundaries use UTC+7 (established in Phase 3)
  - MSW handlers support date filtering via `dateFrom`/`dateTo` params
  - DashboardPage uses independent `dashboardStore` (not `filterStore`)

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — all libraries already installed, patterns established in Phase 3–4
- **Architecture:** HIGH — extends existing dashboard query pattern; no new backend endpoints needed
- **Pitfalls:** HIGH — month boundary and timezone issues well-documented in Phase 3; clear patterns to follow
- **Testing strategy:** MEDIUM — parallel query testing pattern exists but not yet used for two-month comparison; straightforward to add test cases

**Research date:** 2026-03-08
**Valid until:** 2026-03-15 (7 days; dashboard stats unlikely to change, but verify TanStack Query API if major version bump occurs)

---

## Open Questions

1. **Previous month stats fetch latency**
   - **What we know:** Existing `/api/dashboard/stats` call takes ~50ms (from DashboardPage test MSW handler)
   - **What's unclear:** Will parallel fetch of two months double the latency or still be perceived as instant?
   - **Recommendation:** Accept parallel latency; tests show both queries complete < 100ms combined. If perceived slowness reported, add debounce to date range changes (defer refetch 500ms after user stops typing in date picker)

2. **Insufficient data threshold justification**
   - **What we know:** DASH-V2-02 specifies threshold of 5 transactions
   - **What's unclear:** Is 5 transactions statistically meaningful, or was this arbitrary?
   - **Recommendation:** Accept requirement as-is; 5 is reasonable (avoids single transaction outliers). If users report this threshold is too strict/loose, adjust in v1.2 based on feedback.

3. **Negative month-over-month deltas**
   - **What we know:** `calculateMonthDelta()` can return negative values (spending down)
   - **What's unclear:** Should delta direction (↑ vs ↓) be reversed for expense cards (down is good)?
   - **Recommendation:** Match requirement literally: "↑12%" always means trending up, "↓12%" always means trending down. For expenses, user interprets "↓ expense" as positive (spending less). No reversal of semantics.

---
