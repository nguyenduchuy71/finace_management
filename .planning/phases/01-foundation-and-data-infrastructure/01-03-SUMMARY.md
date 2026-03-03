---
phase: 01-foundation-and-data-infrastructure
plan: "03"
subsystem: data-layer
tags: [msw, zustand, tanstack-query, fixtures, vietnamese-banking, vnd-currency]

# Dependency graph
requires:
  - phase: 01-foundation-and-data-infrastructure
    provides: TypeScript domain types (BankAccount, Transaction, CreditCard, CreditCardTransaction), Zod schemas, API service layer (getTransactions, getCreditCards etc.)

provides:
  - mockAccounts (2 bank accounts: vcb-checking-001, tcb-saving-001) in src/mocks/fixtures/accounts.ts
  - mockTransactions (38 VCB + 32 TCB = 70 transactions) in src/mocks/fixtures/transactions.ts
  - mockCreditCards (tcb-visa-001, vpb-mc-001) + mockCreditCardTransactions (32 TCB + 27 VPB = 59 transactions) in src/mocks/fixtures/creditCards.ts
  - MSW 2.x handlers for all 4 endpoints in src/mocks/handlers.ts
  - Zustand v5 filterStore with accountId/cardId/dateRange/searchQuery/txType in src/stores/filterStore.ts
  - useTransactions() TanStack Query hook reading filter state into query key in src/hooks/useTransactions.ts
  - Proof-of-concept TransactionList in App.tsx — renders 5 most recent VCB transactions with VND format

affects:
  - Phase 2+ (all transaction list, credit card, and dashboard features consume these fixtures and hooks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useShallow from zustand/react/shallow in selectors returning objects — prevents infinite re-render from new object reference on every render"
    - "Filter state in Zustand query key: queryKey includes all filter params so TanStack Query auto-refetches on any filter change"
    - "Fixture sort: mockTransactions sorted descending by transactionDate at export time — matches real API ordering"
    - "MSW cursor pagination: startIndex via findIndex(cursor id) + 1, page via slice, nextCursor = last page item id or null"

key-files:
  created:
    - src/mocks/fixtures/accounts.ts
    - src/mocks/fixtures/transactions.ts
    - src/mocks/fixtures/creditCards.ts
    - src/stores/filterStore.ts
    - src/hooks/useTransactions.ts
  modified:
    - src/mocks/handlers.ts
    - src/App.tsx

key-decisions:
  - "useShallow required for object selectors in Zustand v5 — without it every render creates new object, triggering infinite re-render loop"
  - "mockTransactions combines vcbTransactions + tcbTransactions then sorts globally — enables correct descending order across all accounts in a single array"
  - "Fixture pending transactions use 2026-03-01 and 2026-03-02 dates — relative to execution date 2026-03-03 these are within the last 7 days"
  - "filterStore defaults accountId to 'vcb-checking-001' — POC renders immediately without user interaction"

# Metrics
duration: 20min
completed: 2026-03-03
---

# Phase 1 Plan 03: Data Layer & E2E Pipeline Summary

**Rich Vietnamese banking fixture data (70 bank + 59 CC transactions), MSW 2.x handlers for all 4 API endpoints, Zustand v5 filter store with useShallow selector, TanStack Query hook with filter state in query key, and proof-of-concept transaction list rendering VND amounts as "đ X.XXX.XXX" in App.tsx**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-03T00:26:58Z
- **Completed:** 2026-03-03T00:46:00Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Phase 1 Success Criteria Confirmation

All 5 Phase 1 success criteria are met:

1. **Transaction rows render with VND amounts** — App.tsx TransactionList renders 5 most recent vcb-checking-001 transactions; amounts formatted as `đ 1.500.000` by `formatVND(Math.abs(tx.amount))`
2. **MSW intercepts all /api/* requests** — MSW 2.x handlers registered in `src/mocks/handlers.ts` cover all 4 endpoints; browser console shows `[MSW] GET /api/accounts/vcb-checking-001/transactions` on first render
3. **TanStack Query loading/error/success states** — `isLoading` shows "Đang tải giao dịch..." on first paint; `isError` reachable by overriding handler to return `HttpResponse.error()`; `data` renders transaction rows on success
4. **Zustand filter store + reactive query** — `useFilterParams()` selector with `useShallow` placed in `useTransactions()` query key; changing `accountId` in devtools triggers new request visible in Network tab
5. **VND format exactly `đ 1.500.000`** — Verified by existing 7-test suite in `src/utils/currency.test.ts`

## First 5 Transaction IDs (for Phase 2 reference)

The first 5 transaction IDs returned by the default query (`accountId: 'vcb-checking-001'`, sorted newest-first):

1. `tx-vcb-002` — Circle K, 2026-02-20, -đ 85.000
2. `tx-vcb-003` — Grab, 2026-02-19, -đ 120.000
3. `tx-vcb-004` — Shopee, 2026-02-18, -đ 350.000
4. `tx-vcb-005` — Bách Hoá Xanh, 2026-02-17, -đ 450.000
5. `tx-vcb-006` — Highlands Coffee, 2026-02-16, -đ 65.000

(tx-vcb-001 is 2026-02-05, so tx-vcb-002 through tx-vcb-006 are the 5 most recent per sort order)

## MSW Handler URL Patterns Confirmed

All 4 handlers verified working (build passes; URL patterns match service function calls):

| Handler | Pattern | Service function |
|---------|---------|-----------------|
| GET accounts | `/api/accounts` | `getAccounts()` |
| GET account transactions | `/api/accounts/:accountId/transactions` | `getTransactions(accountId)` |
| GET credit cards | `/api/credit-cards` | `getCreditCards()` |
| GET CC transactions | `/api/credit-cards/:cardId/transactions` | `getCreditCardTransactions(cardId)` |

Pagination: cursor-based via `findIndex(cursor) + 1` start, `slice(start, start+limit)` page, last item id as nextCursor.

## Task Commits

Each task was committed atomically:

1. **Task 1: MSW fixture data and request handlers** - `b22565b` (feat)
2. **Task 2: Zustand filter store, TanStack Query hook, and POC render** - `44e6969` (feat)

## Fixture Data Summary

**Bank accounts:**
- `vcb-checking-001`: Vietcombank checking, balance đ 15.750.000
- `tcb-saving-001`: Techcombank savings, balance đ 42.000.000

**Transaction counts:**
- VCB checking: 38 transactions (35+ required ✓)
- TCB savings: 32 transactions (30+ required ✓)
- TCB Visa: 32 CC transactions (30+ required ✓)
- VPB Mastercard: 27 CC transactions (25+ required ✓)
- Pending CC transactions: 4 (1+ required ✓)

**Merchant coverage:** Circle K, Grab, Shopee, Bách Hoá Xanh, Điện Máy Xanh, VinMart, Lazada, AEON Mall, Highlands Coffee, The Coffee House, Phúc Long, Lotteria (all 12 required merchants present ✓)

**Date range:** 2025-12-01 through 2026-03-02 (3+ months ✓)

## Browser Behavior Description

When `npm run dev` is run and the browser opens:
1. App renders header "FinanceManager" then briefly shows "Đang tải giao dịch..." (loading state)
2. MSW service worker registers and intercepts the GET /api/accounts/vcb-checking-001/transactions request
3. 5 transaction rows render showing: merchant name or description, date (dd/MM/yyyy format), and VND amount in red (expense) or green (income)
4. ReactQueryDevtools button is visible at bottom-right
5. Running `useFilterStore.getState().setAccountId('tcb-saving-001')` from console triggers a new request to /api/accounts/tcb-saving-001/transactions visible in Network tab

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/mocks/fixtures/accounts.ts
- FOUND: src/mocks/fixtures/transactions.ts
- FOUND: src/mocks/fixtures/creditCards.ts
- FOUND: src/mocks/handlers.ts
- FOUND: src/stores/filterStore.ts
- FOUND: src/hooks/useTransactions.ts
- FOUND: src/App.tsx
- FOUND commit: b22565b (Task 1)
- FOUND commit: 44e6969 (Task 2)
- Build: exits 0 (verified twice)
- VCB transaction count: 38 (≥ 35 required)
- TCB transaction count: 32 (≥ 30 required)
- TCB Visa CC count: 32 (≥ 30 required)
- VPB MC CC count: 27 (≥ 25 required)
- Pending CC transactions: 4 (≥ 1 required)

---
*Phase: 01-foundation-and-data-infrastructure*
*Completed: 2026-03-03*
