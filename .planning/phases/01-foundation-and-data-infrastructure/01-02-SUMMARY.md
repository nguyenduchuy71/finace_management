---
phase: 01-foundation-and-data-infrastructure
plan: "02"
subsystem: api
tags: [typescript, zod, axios, vitest, date-fns, currency-formatting, domain-types]

# Dependency graph
requires:
  - phase: 01-foundation-and-data-infrastructure
    provides: Vite + React + TypeScript scaffold with vitest and @date-fns/tz dependencies installed

provides:
  - BankAccountSchema, TransactionSchema (Zod + TypeScript) in src/types/account.ts
  - CreditCardSchema, CreditCardTransactionSchema (Zod + TypeScript) in src/types/creditCard.ts
  - PaginatedResponseSchema<T>, ApiError in src/types/api.ts
  - formatVND(), formatVNDSigned() platform-safe VND currency formatters (tested)
  - toVietnamDate(), formatDisplayDate(), formatDisplayDateTime() UTC+7 date utilities (tested)
  - apiClient axios instance with /api base URL and error normalizer
  - getAccounts(), getTransactions() service functions with Zod boundary validation
  - getCreditCards(), getCreditCardTransactions() service functions with Zod boundary validation

affects:
  - 01-03 (MSW mock handlers — needs service function URL patterns and schema shapes)
  - Phase 2+ (all features consume these types, services, and formatters)

# Tech tracking
tech-stack:
  added:
    - vitest v4 (test runner, configured via vitest/config defineConfig)
    - jsdom (test environment for vitest)
  patterns:
    - Zod schemas as single source of truth: schema defined once, TypeScript type derived via z.infer<>
    - PaginatedResponseSchema<T> factory pattern: generic schema wraps any item schema
    - Axios interceptor for error normalization: all errors normalized to ApiError shape before rejection
    - Platform-safe VND formatting: Intl.NumberFormat('vi-VN') + extract only digits/dots with regex
    - UTC+7 date display: TZDate from @date-fns/tz wraps ISO string to correct timezone before format()

key-files:
  created:
    - src/types/api.ts
    - src/types/account.ts
    - src/types/creditCard.ts
    - src/services/apiClient.ts
    - src/services/accounts.ts
    - src/services/creditCards.ts
    - src/utils/currency.ts
    - src/utils/currency.test.ts
    - src/utils/dates.ts
    - src/utils/dates.test.ts
  modified:
    - vite.config.ts (added vitest test config, changed import to vitest/config)
    - tsconfig.app.json (added vitest/globals to types)

key-decisions:
  - "Import defineConfig from 'vitest/config' not 'vite' — vite's defineConfig doesn't include test property in strict TypeScript"
  - "formatVND uses Intl.NumberFormat('vi-VN') then strips non-digit/dot chars — platform-safe because number part is consistent across OS even when symbol position varies"
  - "Zod schema files export both the schema (BankAccountSchema) and the inferred TypeScript type (BankAccount) for dual use at runtime and compile time"
  - "apiClient error interceptor uses typed cast for error parameter since axios error type isn't auto-inferred in TypeScript strict mode"

patterns-established:
  - "Schema-then-type pattern: define z.object({...}) schema, export both schema and z.infer<typeof Schema>"
  - "PaginatedResponseSchema<T> factory: call PaginatedResponseSchema(ItemSchema) at module level for static parse method"
  - "Currency formatter: always call Math.abs() before Intl format, apply sign prefix separately"
  - "Date display: always TZDate(isoString, VN_TZ) then format() — never new Date() for display"

requirements-completed: [FOUND-03, FOUND-04, UX-02]

# Metrics
duration: 15min
completed: 2026-03-03
---

# Phase 1 Plan 02: API Layer & Domain Types Summary

**Zod-validated TypeScript domain types for BankAccount/Transaction/CreditCard, axios API service layer with error normalization, and platform-safe VND currency formatter tested to produce exactly "đ 1.500.000" on all platforms**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-03T00:10:43Z
- **Completed:** 2026-03-03T00:23:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Defined 4 Zod schemas (BankAccountSchema, TransactionSchema, CreditCardSchema, CreditCardTransactionSchema) plus PaginatedResponseSchema<T> generic factory and ApiError — all with derived TypeScript types
- Implemented platform-safe `formatVND()` using `Intl.NumberFormat('vi-VN')` + digit-only regex extraction, verified by 7 passing tests that assert exact output strings
- Built axios API service layer with `/api` base URL, error normalizer interceptor, and Zod boundary validation for all 4 service functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain types, Zod schemas, and tested utility functions** - `9154221` (feat)
2. **Task 2: API service layer (axios client + service functions)** - `13806ab` (feat)

**Plan metadata:** (to be added in docs commit)

## Files Created/Modified

- `src/types/api.ts` - PaginatedResponseSchema<T> factory, ApiError schema + type
- `src/types/account.ts` - BankAccountSchema, TransactionSchema + inferred types
- `src/types/creditCard.ts` - CreditCardSchema, CreditCardTransactionSchema + inferred types
- `src/services/apiClient.ts` - Axios instance pointing to /api, request/response interceptors
- `src/services/accounts.ts` - getAccounts(), getTransactions() with Zod parse at boundary
- `src/services/creditCards.ts` - getCreditCards(), getCreditCardTransactions() with Zod parse at boundary
- `src/utils/currency.ts` - formatVND(), formatVNDSigned() platform-safe implementations
- `src/utils/currency.test.ts` - 5 tests: exact string assertions for all formatting cases
- `src/utils/dates.ts` - toVietnamDate(), formatDisplayDate(), formatDisplayDateTime()
- `src/utils/dates.test.ts` - 2 tests: UTC midnight to UTC+7 next-day conversion verified
- `vite.config.ts` - Added vitest test config (import from vitest/config, jsdom env, globals)
- `tsconfig.app.json` - Added vitest/globals to types array

## Decisions Made

- **vitest/config import:** `defineConfig` must be imported from `vitest/config` not `vite` — TypeScript strict mode rejects the `test` property in vite's version. This is a Rule 1 (bug fix) deviation auto-fixed during Task 1.
- **Platform-safe currency format:** `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n).replace(/[^\d.]/g, '')` extracts only digit+dot chars, immune to OS-level symbol variation (₫ vs đ, trailing vs leading position).
- **apiClient error type cast:** TypeScript strict mode doesn't auto-narrow `unknown` error in interceptors; used explicit type cast for axios error shape rather than any.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vite.config.ts TypeScript error: test property not recognized**
- **Found during:** Task 1 (Vitest configuration step)
- **Issue:** `defineConfig` from `'vite'` doesn't include the `test` property in its TypeScript overloads. `npm run build` produced `error TS2769: No overload matches this call` pointing at the `test` key.
- **Fix:** Changed import from `import { defineConfig } from 'vite'` to `import { defineConfig } from 'vitest/config'`. The vitest package re-exports defineConfig with the test property included.
- **Files modified:** `vite.config.ts`
- **Verification:** `npm run build` exits 0 after fix; `npx vitest run src/utils/` still passes 7 tests.
- **Committed in:** `9154221` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix — plan specified vitest config but didn't specify which package to import defineConfig from. Fix is the standard vitest recommendation.

## Issues Encountered

- `formatVND(0)`: The plan's inline comment suggested the regex might fail for 0. In practice, `Intl.NumberFormat('vi-VN')` formats 0 as "0 ₫" in jsdom (Node.js), and `.replace(/[^\d.]/g, '')` correctly extracts `"0"`, giving `"đ 0"`. No fix needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All domain type contracts locked and exported — Plan 03 (MSW handlers) can immediately import BankAccountSchema, TransactionSchema etc. to build typed fixture data
- Service function signatures ready for MSW URL matching: `GET /api/accounts`, `GET /api/accounts/:id/transactions`, `GET /api/credit-cards`, `GET /api/credit-cards/:id/transactions`
- `formatVND()` and `formatDisplayDate()` ready for consumption by all UI components in Phase 2+
- No blockers

## Self-Check: PASSED

- FOUND: src/types/api.ts
- FOUND: src/types/account.ts
- FOUND: src/types/creditCard.ts
- FOUND: src/services/apiClient.ts
- FOUND: src/services/accounts.ts
- FOUND: src/services/creditCards.ts
- FOUND: src/utils/currency.ts
- FOUND: src/utils/dates.ts
- FOUND: src/utils/currency.test.ts
- FOUND: src/utils/dates.test.ts
- FOUND commit: 9154221 (Task 1)
- FOUND commit: 13806ab (Task 2)
- Tests: 7/7 passed
- Build: exits 0

---
*Phase: 01-foundation-and-data-infrastructure*
*Completed: 2026-03-03*
