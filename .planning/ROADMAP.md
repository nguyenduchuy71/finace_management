# Roadmap: FinanceManager

## Overview

Starting from an empty Vite project, this roadmap delivers a personal finance dashboard where a user can see all their bank and credit card transactions in one place, organized by billing cycle. Phase 1 lays the data infrastructure that everything else depends on. Phase 2 delivers the core transaction views with filtering. Phase 3 implements the product's main differentiator: credit card billing cycle display and grouping. Phase 4 adds the dashboard charts and polishes responsive behavior across devices.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Data Infrastructure** - Project scaffolding, type contracts, mock API, state management wiring
- [ ] **Phase 2: Core Transaction Views** - Bank and credit card transaction lists with filter and search
- [ ] **Phase 3: Credit Card Billing Cycle** - Statement cycle display, billing cycle grouping (product differentiator)
- [ ] **Phase 4: Dashboard and Polish** - Summary charts, income/expense totals, responsive layout verification

## Phase Details

### Phase 1: Foundation and Data Infrastructure
**Goal**: The data layer is fully operational — TypeScript domain types exist, MSW mock API returns realistic fixture data, TanStack Query and Zustand are configured, and a working data fetch renders on screen
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, UX-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` starts the app with no TypeScript errors and no console errors
  2. The app fetches mock transaction data from MSW and renders at least one transaction row on screen
  3. VND currency amounts display as `đ 1.500.000` format (no decimals, dots as thousand separators)
  4. TanStack Query loading, error, and success states are all reachable in the browser by toggling MSW handler responses
  5. Zustand filter store exists and a filter state change in devtools causes a query param update (observable in Network tab)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Vite + React 19 + TypeScript strict + Tailwind CSS + shadcn/ui scaffold and App shell
- [x] 01-02-PLAN.md — TypeScript domain types, Zod schemas, axios service layer, utility functions with tests
- [ ] 01-03-PLAN.md — MSW 2.x handlers + Vietnamese fixture data, Zustand filter store, proof-of-concept transaction render

### Phase 2: Core Transaction Views
**Goal**: Users can browse all bank and credit card transactions, apply filters, and search — the full read-only transaction viewing experience works end-to-end
**Depends on**: Phase 1
**Requirements**: BANK-01, BANK-02, BANK-03, BANK-04, CC-01, CC-02, FILTER-01, FILTER-02, FILTER-03, FILTER-04, DASH-03
**Success Criteria** (what must be TRUE):
  1. User can see a paginated list of bank account transactions showing date, description, amount in VND, and transaction type
  2. User can switch between individual bank accounts and see only that account's transactions
  3. User can see a list of credit card transactions showing date, merchant, amount, and pending/posted status
  4. User can filter any transaction list by date range, account, and transaction type (income/expense)
  5. User can type in a search box and the transaction list narrows to matching names or descriptions
  6. All data sections show a loading skeleton while fetching, an error message on failure, and an empty state when no results match
**Plans**: TBD

Plans:
- [ ] 02-01: Transaction list components — TransactionList, TransactionRow, pagination, loading/error/empty states
- [ ] 02-02: Filter and search controls — DateRangePicker, AccountFilter, TypeFilter, TextSearch wired to Zustand store
- [ ] 02-03: Bank and credit card pages — BankAccountsPage, CreditCardsPage, account switching

### Phase 3: Credit Card Billing Cycle
**Goal**: Users can see their credit card billing cycle information — current cycle dates, statement date, days until close — and transactions are organized by billing cycle rather than calendar month
**Depends on**: Phase 2
**Requirements**: CC-03, CC-04
**Success Criteria** (what must be TRUE):
  1. User can see the current billing cycle's start date, end date, and statement closing date for each credit card
  2. User can see days remaining until the statement closes displayed on the credit card detail view
  3. Credit card transactions are grouped under their correct billing cycle heading (not by calendar month)
  4. Billing cycle boundary calculations use Vietnam timezone (UTC+7) and do not shift dates when the browser is in a UTC timezone
**Plans**: TBD

Plans:
- [ ] 03-01: Billing cycle utilities — date-fns-tz cycle boundary calculation, groupTransactionsByBillingCycle, getCurrentBillingCycle
- [ ] 03-02: BillingCycleCard component and CreditCardPage with grouped transaction display

### Phase 4: Dashboard and Polish
**Goal**: Users have a one-glance financial summary with income/expense totals and a category breakdown chart, and the application is fully usable on mobile
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, UX-01
**Success Criteria** (what must be TRUE):
  1. User can see total income and total expenses for the currently selected period on the dashboard
  2. User can see a category breakdown chart (donut or bar) showing spending distribution for the selected period
  3. All pages are usable on a 375px wide mobile screen — no horizontal overflow, no overlapping elements, tap targets are reachable
  4. Charts do not re-render and re-animate when filter state changes that do not affect chart data
**Plans**: TBD

Plans:
- [ ] 04-01: Dashboard summary — income/expense totals, DashboardPage layout
- [ ] 04-02: Category chart — Recharts donut/bar chart with memoized data, responsive Tailwind breakpoints

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Data Infrastructure | 2/3 | In progress | - |
| 2. Core Transaction Views | 0/3 | Not started | - |
| 3. Credit Card Billing Cycle | 0/2 | Not started | - |
| 4. Dashboard and Polish | 0/2 | Not started | - |
