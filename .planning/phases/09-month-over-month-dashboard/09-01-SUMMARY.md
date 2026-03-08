---
phase: 09-month-over-month-dashboard
plan: 01
type: execute
subsystem: dashboard
tags: [month-over-month, delta, trends, statistics]
dependencies:
  requires: [dashboard-core, date-utilities]
  provides: [month-delta-calculation, parallel-query-loading, delta-display-ui]
  affects: [DashboardPage, StatCard, useDashboardStats hook]
tech_stack:
  added: [useQueries from @tanstack/react-query, @date-fns/tz for Vietnam timezone]
  patterns: [Parallel query loading, delta computation from existing data, conditional UI rendering]
key_files:
  created:
    - src/utils/dates.test.ts (12 tests for month delta utilities)
    - src/hooks/useDashboardStats.test.ts (9 new tests added to existing file)
    - src/features/dashboard/StatCard.test.tsx (12 tests for delta badge display)
  modified:
    - src/utils/dates.ts (added calculateMonthDelta, getPreviousMonthDateRange)
    - src/hooks/useDashboardStats.ts (refactored to use useQueries, parallel month fetching)
    - src/features/dashboard/StatCard.tsx (added delta badge, conditional rendering)
    - src/pages/DashboardPage.tsx (wired delta props to stat cards)
    - src/features/dashboard/DashboardPage.test.tsx (updated to verify dual API calls)
decisions:
  - Use useQueries for parallel current/previous month fetching (not sequential)
  - Calculate deltas from existing dashboard stats endpoint (no extra API calls)
  - Hide delta and show "Chưa đủ dữ liệu" when currentMonth < 5 transactions (requirement DASH-V2-02)
  - Use TZDate with Vietnam UTC+7 timezone for month boundary calculations (consistent with Phase 3)
  - Color semantics: income (↑green, ↓red), expense (↑red, ↓green) for intuitive trend display
metrics:
  duration: 22 minutes
  completed_date: "2026-03-08T15:47:00Z"
  tasks_completed: 4
  files_created: 3
  files_modified: 5
  tests_added: 33
  test_files: 3
---

# Phase 09 Plan 01: Month-over-Month Dashboard Summary

Add month-over-month delta trends to dashboard stat cards, comparing income and expense totals to the previous calendar month.

**One-liner:** Dashboard stat cards enhanced with optional delta badges showing % change vs previous month (↑12% vs tháng trước), calculated from existing API data in parallel, hidden when insufficient data (< 5 transactions).

## Execution Summary

All 4 tasks completed successfully. Month-over-month delta display implemented with full test coverage (33 new tests). No blockers or deviations.

### Tasks Completed

| Task | Name | Type | Status | Commit |
|------|------|------|--------|--------|
| 1 | Add month delta utilities | auto | DONE | f4ef314 |
| 2 | Extend useDashboardStats hook | auto | DONE | 98dd342 |
| 3 | Extend StatCard for delta display | auto+tdd | DONE | abdad43 |
| 4 | Wire delta props in DashboardPage | auto | DONE | bd04c84 |

## What Was Built

### 1. Month Delta Utilities (src/utils/dates.ts)

**Functions added:**

- `calculateMonthDelta(currentAmount, previousAmount): number | null`
  - Calculates percentage change: `((current - previous) / previous) * 100`
  - Returns null if previousAmount <= 0 (cannot calculate from zero/negative)
  - Returns rounded whole number percentage

- `getPreviousMonthDateRange(dateFrom, dateTo): { prevFrom, prevTo }`
  - Computes previous month start/end dates in Vietnam UTC+7 timezone
  - Handles month boundaries (Feb→Jan 31, Dec→Dec 1 of prev year)
  - Leap year safe (Feb 29 in 2024, Feb 28 in 2026)
  - Returns ISO format strings (YYYY-MM-DD)

**Test coverage:** 12 tests
- Delta calculation: positive (+50%), negative (-50%), edge cases (zero/negative previous)
- Month boundaries: Jan→Dec prev year, year transitions, month-end edge cases
- Leap year handling: Feb 29 and Feb 28 transitions

### 2. Parallel Query Hook (src/hooks/useDashboardStats.ts)

**Refactored from single useQuery to useQueries:**

- Fetches current month stats AND previous month stats in parallel (not sequential)
- Calculates `incomeDelta` and `expenseDelta` once both queries complete
- Returns new props:
  - `incomeDelta`: number | null (% change in income)
  - `expenseDelta`: number | null (% change in expenses)
  - `deltaLoading`: boolean (true while previous month still loading after current loaded)
- Maintains backward compatibility: `data`, `isLoading`, `isError`, `refetch()` unchanged

**Benefits:**
- No extra API calls (uses existing `/dashboard/stats` endpoint twice with different date ranges)
- Parallel loading: both months fetched simultaneously
- Graceful loading states: UI can show "Đang tính..." while waiting for second query

**Test coverage:** 9 new tests added (total 14)
- Parallel query verification
- Delta calculation correctness (20% increase, 25% increase, 25% decrease scenarios)
- Loading states: deltaLoading during transition, final state when complete
- Error handling: isError=true if either query fails
- Refetch behavior: both queries refetched together

### 3. StatCard Delta Display (src/features/dashboard/StatCard.tsx)

**New props:**
- `delta?: number | null` — month-over-month percentage
- `deltaLoading?: boolean` — feedback while previous month data loads

**Conditional rendering logic:**
- If `transactionCount === 0`: Show "Không có giao dịch trong kỳ này" (no delta)
- If `deltaLoading === true`: Show "Đang tính..." (calculating)
- If `delta === null` OR `transactionCount < 5`: Show "Chưa đủ dữ liệu" (insufficient data)
- Otherwise: Render delta badge with direction and percentage
  - Format: `↑12% vs tháng trước` (positive) or `↓8% vs tháng trước` (negative)
  - Color semantics:
    - **Income variant:** ↑ green (good), ↓ red (bad)
    - **Expense variant:** ↑ red (bad), ↓ green (good)

**Styling:** text-xs, color classes for emerald/red variants, positioned below amount display

**Test coverage:** 12 tests
- Delta display with ↑/↓ arrows
- Insufficient data message (< 5 transactions, delta=null)
- Loading state ("Đang tính...")
- Zero transactions special case
- Color semantics: positive/negative for both variants
- Zero delta rendering

### 4. DashboardPage Integration (src/pages/DashboardPage.tsx)

**Changes:**
- Destructure `incomeDelta`, `expenseDelta`, `deltaLoading` from useDashboardStats hook
- Pass delta props to both income and expense StatCard components
- Pass deltaLoading to both cards for consistent UI feedback

**Result:** Dashboard now displays:
```
┌─────────────────┬─────────────────┐
│ Tổng thu        │ Tổng chi        │
│ đ 10.000.000    │ đ 5.000.000     │
│ ↑12% vs tháng   │ ↓8% vs tháng    │
│ trước (green)   │ trước (green)   │
└─────────────────┴─────────────────┘
```

Updated DashboardPage test to verify both API calls (current + previous month) are made.

## Must-Haves Verification

### Truths

1. **✅ Delta badges display with month-over-month % change** (e.g., ↑12% vs tháng trước)
   - Implemented in StatCard component
   - Tested: 2 test cases (positive/negative deltas)

2. **✅ Delta hidden with "Chưa đủ dữ liệu" when current month < 5 transactions**
   - Implemented: `transactionCount < 5` check in StatCard
   - Tested: 1 test case (insufficient data message)
   - Requirement DASH-V2-02 satisfied

3. **✅ Previous month data fetched in parallel; both complete before delta calculated**
   - Implemented: useQueries() with two queries, delta computed in conditional logic
   - Tested: 4 test cases (parallel loading, deltaLoading state, delta calculation timing)

4. **✅ Month boundaries calculated in Vietnam UTC+7 timezone**
   - Implemented: getPreviousMonthDateRange uses TZDate('Asia/Ho_Chi_Minh')
   - Tested: 3 test cases (Jan→Dec, year boundaries, month-end)

5. **✅ No extra API calls; delta computed from existing endpoint**
   - Verified: Dashboard test captures both API calls (2 calls to /api/dashboard/stats with different date ranges)
   - No new endpoints created
   - No additional HTTP requests beyond the two date-range variations

### Artifacts

| Path | Status | Exports/Contains |
|------|--------|------------------|
| src/utils/dates.ts | ✅ created | `calculateMonthDelta`, `getPreviousMonthDateRange` |
| src/utils/dates.test.ts | ✅ created | 12 tests: delta calc, month boundaries |
| src/hooks/useDashboardStats.ts | ✅ modified | useQueries, parallel loading, delta return |
| src/hooks/useDashboardStats.test.ts | ✅ modified | 9 new tests added (14 total) |
| src/features/dashboard/StatCard.tsx | ✅ modified | delta badge rendering, conditional display |
| src/features/dashboard/StatCard.test.tsx | ✅ created | 12 tests: delta display, colors, thresholds |
| src/pages/DashboardPage.tsx | ✅ modified | delta props wired to StatCards |
| src/features/dashboard/DashboardPage.test.tsx | ✅ modified | updated for dual API calls |

### Key Links

| From | To | Via | Pattern Match |
|------|----|----|---|
| useDashboardStats hook | getDashboardStats service | useQueries() makes two parallel calls | `queryKey.*dashboardStats.*dateFrom.*dateTo` |
| getPreviousMonthDateRange | @date-fns/tz | TZDate('Asia/Ho_Chi_Minh') | `TZDate\\(.*VN_TZ\\)` |
| StatCard | calculateMonthDelta | delta prop from DashboardPage | `delta={incomeDelta\|expenseDelta}` |
| StatCard rendering | transactionCount threshold | conditional display logic | `transactionCount.*>=.*5` |

## Test Coverage

**Total tests added:** 33
**Total tests passing:** 231 (0 regressions)

### By Component

| Component | Test File | Tests | Status |
|-----------|-----------|-------|--------|
| calculateMonthDelta | dates.test.ts | 6 tests | ✅ passing |
| getPreviousMonthDateRange | dates.test.ts | 6 tests | ✅ passing |
| useDashboardStats (new) | useDashboardStats.test.ts | 9 tests | ✅ passing |
| StatCard (delta display) | StatCard.test.tsx | 12 tests | ✅ passing |
| DashboardPage (integration) | DashboardPage.test.tsx | 11 tests (1 updated) | ✅ passing |

### Test Scenarios Covered

- **Positive/negative deltas:** +50%, -50%, 0%
- **Insufficient data:** transactionCount < 5, delta = null
- **Loading states:** deltaLoading true/false, isLoading transitions
- **Color semantics:** income/expense variants with correct green/red mapping
- **Month boundaries:** year transitions, leap years, month-end dates
- **Parallel loading:** both queries initiated, one completing before other
- **Error handling:** either query fails → isError=true
- **Backward compatibility:** existing useDashboardStats consumers still work

## Deviations from Plan

None. Plan executed exactly as written. All success criteria met.

## Requirements Met

- **DASH-V2-01:** Income/expense stat cards show delta vs previous month ✅
  - Format: ↑12% vs tháng trước (with correct arrows and percentage)
  - Correct color coding for income (↑green, ↓red) and expense (↑red, ↓green)

- **DASH-V2-02:** Delta hidden with "Chưa đủ dữ liệu" when current month < 5 transactions ✅
  - Suppresses misleading early-month snapshots
  - Graceful degradation: shows message instead of breaking UI

## Technical Decisions

1. **useQueries over useQuery + manual refetch:** Better React Query integration, automatic loading state management
2. **TZDate with Vietnam timezone:** Consistent with Phase 3 billing cycle implementation, avoids browser timezone drift
3. **Separate calculateMonthDelta utility:** Reusable, testable, single-responsibility
4. **Conditional delta display in StatCard:** Cleaner than prop drilling for all edge cases
5. **No new API endpoints:** Leverages existing /api/dashboard/stats with different date ranges

## Browser Compatibility

- React 19, TypeScript 5.9.3, TanStack Query v5 with @date-fns/tz
- No new dependencies required (all already installed)
- Vietnam timezone (UTC+7) handled by @date-fns/tz library

## Next Steps

Phase 09 Plan 01 complete. Ready for Phase 09 Plan 02 (if exists) or next milestone planning.
