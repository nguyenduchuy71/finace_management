---
phase: 03-credit-card-billing-cycle
plan: "01"
subsystem: ui
tags: [date-fns, typescript, billing-cycle, timezone, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-foundation-and-data-infrastructure
    provides: "CreditCardTransaction type, @date-fns/tz and date-fns dependencies, @/ path alias"
provides:
  - "computeCurrentCycle — pure function computing billing cycle boundaries from statementDay + current time"
  - "groupTransactionsByCycle — groups CreditCardTransactions by cycle; pending txs assigned to currentCycle"
  - "formatCycleDateRange — converts UTC ISO cycle boundaries to VN-local inclusive display strings"
  - "BillingCycle and BillingCycleGroupData interfaces for type-safe cycle data"
affects: [03-02-credit-card-billing-page, any-feature-using-billing-cycles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "17:00 UTC = midnight VN (UTC+7) boundary convention for billing cycle cuts"
    - "TZDate constructor for timezone-aware date math without manual offset arithmetic"
    - "subDays(endVN, 1) to convert exclusive end boundary to inclusive last-day display"
    - "Map<string, Group> pattern for transaction grouping with cycleKey as React key"

key-files:
  created:
    - src/utils/billingCycle.ts
    - src/utils/billingCycle.test.ts
  modified:
    - src/mocks/fixtures/creditCards.ts

key-decisions:
  - "17:00 UTC as cycle boundary equals midnight VN (UTC+7) — all cycle math uses this constant offset"
  - "subDays applied to endVN (not endUTC) to correctly produce inclusive last calendar day in VN timezone"
  - "Pending txs (no billingCycleStart) assigned to currentCycle.startISO key — enables single-pass Map grouping"
  - "Sort groups by cycleKey descending (ISO string compare) — newest cycle first for display"

patterns-established:
  - "Billing cycle date boundary: boundary_UTC = Date.UTC(year, month0, statementDay, 17, 0, 0) equals 00:00 VN"
  - "TZDate(isoString, VN_TZ) for any timezone-sensitive display or comparison"

requirements-completed: [CC-03, CC-04]

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 3 Plan 01: Billing Cycle Utility Layer Summary

**Pure billing cycle functions with TDD: computeCurrentCycle handles month/year rollovers in VN timezone, groupTransactionsByCycle assigns pending txs to current cycle, formatCycleDateRange produces inclusive dd/MM/yyyy display strings**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T23:19:35Z
- **Completed:** 2026-03-03T23:27:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Implemented `computeCurrentCycle` with correct handling of: pre-statementDay (prev-month cycle), post-statementDay (curr-month cycle), December-to-January year rollover, January backward rollover to December, and on-statementDay boundary at 16:00 VN (before 17:00 UTC cut)
- Implemented `groupTransactionsByCycle` using a Map for O(n) grouping — pending transactions (undefined billingCycleStart) assigned to currentCycle group, posted transactions keyed by their billingCycleStart
- Implemented `formatCycleDateRange` converting UTC ISO boundaries to VN-local inclusive display dates
- All 8 test cases pass, zero TypeScript errors, zero regressions in existing 7 tests
- Corrected misleading fixture comments in creditCards.ts to document the actual VN midnight convention

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for billingCycle utilities** - `4d20b12` (test)
2. **Task 2: Implement billingCycle.ts** - `92d1242` (feat)

_Note: TDD plan — Task 1 is RED (failing tests), Task 2 is GREEN (implementation)_

## Files Created/Modified

- `src/utils/billingCycle.ts` - Three exported functions + two exported interfaces for billing cycle date math
- `src/utils/billingCycle.test.ts` - 8 test cases covering all boundary conditions
- `src/mocks/fixtures/creditCards.ts` - Corrected CYCLE_JAN_START and CYCLE_JAN_END comments to reflect actual VN midnight convention

## Decisions Made

- **17:00 UTC = midnight VN boundary:** All cycle start/end timestamps use `Date.UTC(y, m, statementDay, 17, 0, 0)`. This equals 00:00 VN (UTC+7). Applied consistently so fixture data and utility functions agree.
- **subDays on endVN not endUTC:** The end boundary is exclusive (midnight of day after last day). Subtracting 1 day in VN timezone gives the correct last calendar day for display, regardless of DST shifts (Vietnam has no DST but TZDate handles this correctly).
- **Pending tx grouping via currentCycle.startISO key:** A single Map pass handles both pending and posted transactions. The `isCurrentCycle` flag is set at group creation time, not post-hoc.
- **ISO string comparison for newest-first sort:** `b.cycleKey.localeCompare(a.cycleKey)` correctly sorts UTC ISO strings descending without Date construction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tests passed on first implementation attempt. TypeScript was clean immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Billing cycle utility layer complete and tested — plan 03-02 can import and use all three functions directly
- Components in 03-02 should call `computeCurrentCycle(card.statementDate, new Date().toISOString())` to get current cycle
- `groupTransactionsByCycle` output's `BillingCycleGroupData[]` is ready to drive cycle accordion UI in 03-02

---
*Phase: 03-credit-card-billing-cycle*
*Completed: 2026-03-04*
