---
phase: "02"
plan: "02-01"
subsystem: data-layer
tags: [data-layer, hooks, msw, services, components, shadcn]
dependency_graph:
  requires: []
  provides: [useInfiniteQuery-hooks, filter-service-layer, skeleton-components, shadcn-ui-components]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: [sonner, react-day-picker (via calendar)]
  patterns: [useInfiniteQuery cursor pagination, TransactionFilters interface, MSW server-side filter simulation]
key_files:
  created:
    - src/hooks/useCreditCardTransactions.ts
    - src/hooks/useAccounts.ts
    - src/hooks/useCreditCards.ts
    - src/hooks/useDebounced.ts
    - src/features/transactions/TransactionListSkeleton.tsx
    - src/features/transactions/TransactionEmptyState.tsx
    - src/features/creditCards/CreditCardTransactionListSkeleton.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/button.tsx
    - src/components/ui/calendar.tsx
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/select.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/sonner.tsx
  modified:
    - src/hooks/useTransactions.ts
    - src/services/accounts.ts
    - src/services/creditCards.ts
    - src/mocks/handlers.ts
decisions:
  - "useInfiniteQuery returns undefined (not null) as getNextPageParam sentinel — TanStack Query v5 requirement"
  - "TransactionFilters interface lives in accounts.ts and is imported by creditCards.ts to avoid circular deps"
  - "MSW credit card income filter returns empty array — CC transactions are always expenses by design"
  - "useDebounced uses setTimeout/clearTimeout cleanup — no external debounce lib needed"
metrics:
  duration: "18 min"
  completed_date: "2026-03-03"
  tasks: 6
  files_created: 20
  files_modified: 4
---

# Phase 02 Plan 01: Data Layer Upgrades & Foundation Components Summary

**One-liner:** useInfiniteQuery cursor pagination with server-side MSW filtering via TransactionFilters interface, plus 10 shadcn components and 3 async-state components for DASH-03.

## What Was Built

### Task 01 — Install shadcn components
All 10 shadcn components required for Phase 2 were installed and committed: badge, button, calendar, card, input, popover, select, skeleton, tabs, sonner. Components were already present from prior install; committed untracked files to git.

### Task 02 — Enhance MSW handlers with filter support
Rewrote `src/mocks/handlers.ts` to add full server-side filter simulation for both the bank transactions handler and credit card transactions handler. Filters supported: `search` (text match on description/merchantName), `dateFrom` (ISO date lower bound), `dateTo` (ISO date upper bound with T23:59:59Z suffix), `txType` (all/income/expense). Credit card handler returns empty array when txType=income since CC transactions are always expenses.

### Task 03 — Update service functions to forward filter params
Added `TransactionFilters` interface to `src/services/accounts.ts` and updated `getTransactions` to accept and forward all filter params as query params. Updated `src/services/creditCards.ts` to import `TransactionFilters` and updated `getCreditCardTransactions` with the same filter-forwarding signature.

### Task 04 — Upgrade useTransactions to useInfiniteQuery
Replaced `useQuery` with `useInfiniteQuery` in `src/hooks/useTransactions.ts`. Added `initialPageParam: undefined` and `getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined` following TanStack Query v5 cursor pattern. All filter params from Zustand store forwarded to `getTransactions`.

### Task 05 — Create new hooks
- `useCreditCardTransactions`: useInfiniteQuery with cardId from filterStore, full filter forwarding
- `useAccounts`: simple useQuery wrapping getAccounts service
- `useCreditCards`: simple useQuery wrapping getCreditCards service
- `useDebounced<T>`: generic debounce hook using setTimeout cleanup for search inputs

### Task 06 — Create skeleton and empty state components (DASH-03)
- `TransactionListSkeleton`: renders N skeleton rows (default 5) for bank transaction list
- `TransactionEmptyState`: bilingual Vietnamese empty state with `hasFilters` prop switching between "no filters" and "no results" messages
- `CreditCardTransactionListSkeleton`: renders N skeleton rows with extra badge placeholder

## Commits

| Task | Hash | Description |
|------|------|-------------|
| T01 | cade928 | chore(02-01-T01): install shadcn components for Phase 2 |
| T02 | 0411bbc | feat(02-01-T02): enhance MSW handlers with filter support |
| T03 | 2bdf0fc | feat(02-01-T03): update service functions to forward filter params |
| T04 | d38900f | feat(02-01-T04): upgrade useTransactions to useInfiniteQuery |
| T05 | cde13b3 | feat(02-01-T05): create useCreditCardTransactions, useAccounts, useCreditCards, useDebounced |
| T06 | 9a2181f | feat(02-01-T06): create skeleton and empty state components (DASH-03) |

## Verification Results

All must-haves confirmed:

- All 9 shadcn components present in src/components/ui/
- useTransactions.ts uses useInfiniteQuery with initialPageParam and getNextPageParam
- MSW handlers filter by search, dateFrom, dateTo, txType query params
- getTransactions and getCreditCardTransactions accept and forward TransactionFilters
- useCreditCardTransactions, useAccounts, useCreditCards, useDebounced hooks exist
- TransactionListSkeleton, TransactionEmptyState, CreditCardTransactionListSkeleton exist with real JSX
- npx tsc --noEmit exits with zero errors

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- src/hooks/useCreditCardTransactions.ts: FOUND
- src/hooks/useAccounts.ts: FOUND
- src/hooks/useCreditCards.ts: FOUND
- src/hooks/useDebounced.ts: FOUND
- src/features/transactions/TransactionListSkeleton.tsx: FOUND
- src/features/transactions/TransactionEmptyState.tsx: FOUND
- src/features/creditCards/CreditCardTransactionListSkeleton.tsx: FOUND
- src/services/accounts.ts (TransactionFilters): FOUND
- src/mocks/handlers.ts (filter params): FOUND

Commits verified:
- cade928: FOUND
- 0411bbc: FOUND
- 2bdf0fc: FOUND
- d38900f: FOUND
- cde13b3: FOUND
- 9a2181f: FOUND
