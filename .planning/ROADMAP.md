# Roadmap: FinanceManager

## Overview

Starting from an empty Vite project, this roadmap delivers a personal finance dashboard where a user can see all their bank and credit card transactions in one place, organized by billing cycle. Phase 1 lays the data infrastructure that everything else depends on. Phase 2 delivers the core transaction views with filtering. Phase 3 implements the product's main differentiator: credit card billing cycle display and grouping. Phase 4 adds the dashboard charts and polishes responsive behavior across devices.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Data Infrastructure** - Project scaffolding, type contracts, mock API, state management wiring (completed 2026-03-03)
- [ ] **Phase 2: Core Transaction Views** - Bank and credit card transaction lists with filter and search
- [ ] **Phase 3: Credit Card Billing Cycle** - Statement cycle display, billing cycle grouping (product differentiator)
- [x] **Phase 4: Dashboard and Polish** - Summary charts, income/expense totals, responsive layout verification (completed 2026-03-04)
- [x] **Phase 5: Chatbot Integration** - Web chat interface, bot settings (API key, model selection), chat via SDK (completed 2026-03-04)

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
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Dashboard data layer, StatCards, DashboardDatePicker, DashboardPage layout, routing and AppHeader nav
- [ ] 04-02-PLAN.md — Recharts CategoryChart with donut/bar toggle, memoized chart data, mobile responsiveness audit

### Phase 5: Chatbot Integration
**Goal**: Users can configure and interact with an AI chatbot to get financial insights. The chatbot has a web chat interface, settings to manage API credentials and model selection, and uses an SDK to communicate with the LLM.
**Depends on**: Phase 4
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can access a chat interface in the web application
  2. User can configure chatbot settings including API key and model selection
  3. User can send messages and receive responses from the chatbot via an LLM SDK
  4. Chat interface is usable on mobile screens
**Plans**: TBD

Plans:
- [ ] 05-01-PLAN.md
- [ ] 05-02-PLAN.md
- [ ] 05-03-PLAN.md

### Phase 5.1: Chatbot UI Refinements
**Goal**: Improve chatbot user experience with cleaner UI, better message display, and streamlined settings interface.
**Depends on**: Phase 5
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. TanStack DevTools popup removed (development-only tool)
  2. Chat message styling is clean and easy to read
  3. Settings interface is intuitive and not intrusive
  4. Chat panel responsive on mobile and desktop
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 6: Optimize & Deploy
**Goal**: Performance optimization, UI polish refinements, comprehensive testing, and deployment to Vercel production.
**Depends on**: Phase 5
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Lighthouse performance score ≥90 on mobile, ≥95 on desktop
  2. All TypeScript strict mode checks pass with 0 errors
  3. Test suite passes: unit tests, integration tests, E2E coverage for critical flows
  4. UI is polished: consistent spacing, improved visual hierarchy, better animations
  5. App successfully deployed to Vercel with working production URL
  6. No console errors or warnings in production build
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 5.1 → 6 (decimal phases appear between their surrounding integers)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Data Infrastructure | 3/3 | Complete   | 2026-03-03 |
| 2. Core Transaction Views | 3/4 | In Progress | - |
| 3. Credit Card Billing Cycle | 1/2 | In Progress|  |
| 4. Dashboard and Polish | 2/2 | Complete   | 2026-03-04 |
| 5. Chatbot Integration | 3/3 | Complete   | 2026-03-04 |
| 5.1. Chatbot UI Refinements | 0/? | Pending | - |
| 6. Optimize & Deploy | 0/? | Pending | - |
