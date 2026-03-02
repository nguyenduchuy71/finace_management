# Project Research Summary

**Project:** Personal Finance Management Dashboard
**Domain:** Frontend-only personal finance dashboard (bank + credit card transactions, Vietnamese market)
**Researched:** 2026-03-02
**Confidence:** MEDIUM

## Executive Summary

This is a read-only personal finance dashboard built entirely on the frontend, consuming a third-party banking API to display bank account transactions and credit card billing cycle data. The established approach for this type of application is a React + TypeScript SPA built with Vite, using TanStack Query for all server state (API data) and Zustand exclusively for UI-driven state such as filters and date range selections. The architecture is layered: pages compose feature components, feature components call feature hooks, and hooks are the only coupling point between the UI and the API service layer. Mock Service Worker (MSW) intercepts all API calls during development, enabling UI work to proceed in parallel with real API integration.

The recommended stack is well-settled for this use case with no novel choices required. The core differentiator of this product — grouping credit card transactions by billing cycle rather than calendar month, which all major competitors (Mint, Monarch Money) fail to do correctly — is achievable with date-fns date arithmetic and requires billing cycle data from the third-party API. This is the single most important feature risk: if the API does not return statement/billing cycle dates, the primary differentiator falls back to a user-configured cycle date, which must be planned as a fallback from day one.

The two highest-impact risk categories are architectural and data integrity. Architecturally, the server-state vs. client-state split (TanStack Query vs. Zustand) must be decided and enforced from day one — retrofitting it is a high-cost refactor. For data integrity, the Vietnamese Dong (VND) currency is integer-only with no subunit, and amounts may arrive from the API as strings, not numbers; all currency arithmetic must use integer math from the moment data enters the application. Timezone handling for statement cycle boundaries (UTC API timestamps vs. Vietnam local dates) is a second data integrity risk that causes silent failures only in production or UTC-timezone CI environments.

## Key Findings

### Recommended Stack

The stack is React 19 + TypeScript 5.4 + Vite 5 as the foundation, with TanStack Query v5 handling all API data fetching and caching, and Zustand v4 for UI-only client state. UI components are built on shadcn/ui (Radix UI primitives + Tailwind CSS 3.x), charts use Recharts 2.x (SVG-based, declarative, React-native), and date arithmetic uses date-fns 3.x for billing cycle calculations. All API responses are validated at the service boundary using Zod 3.x schemas, which also provide TypeScript type inference to prevent the "type lie" problem when real API shapes differ from assumptions. Mock API development uses MSW 2.x, which intercepts real HTTP calls at the service worker level — no conditional URL logic in components.

See full analysis: `.planning/research/STACK.md`

**Core technologies:**
- React 19 + TypeScript 5.4: UI framework with strict typing — finance data demands correctness; wrong balance display is a bug, not a cosmetic issue
- Vite 5: Build tool and dev server — 10-100x faster HMR than CRA (deprecated), native ESM, integrates cleanly with MSW
- TanStack Query v5: Server state management — handles caching, background refetch, loading/error states automatically; eliminates 80% of manual state boilerplate
- Zustand v4: Client UI state — lightweight, minimal boilerplate for filter selections, date range, active account, modal state; never holds API data
- shadcn/ui + Tailwind CSS 3.x: Component system — copy-owned components on Radix primitives; avoids MUI/Ant Design lock-in; dashboard aesthetics fully controllable
- Recharts 2.x: Charts — declarative SVG React components; best for time-series spending trends and category breakdowns
- date-fns 3.x: Date arithmetic — functional, tree-shakeable, tree-shakes to near-zero; required for billing cycle boundary calculations (cycle start/end, days until statement date)
- Zod 3.x: API response validation — parse and validate at the service boundary; derive TypeScript types from schemas; prevents type drift when real API differs from mock
- MSW 2.x: Mock API — intercepts real HTTP at network level in browser; single `main.tsx` guard; no conditional URLs in service files
- axios 1.x: HTTP client — interceptors for auth headers, global error normalization; cleaner than raw fetch for a third-party API with authentication

### Expected Features

The product's core differentiator is billing-cycle-grouped credit card transactions. Every major competitor groups by calendar month; this product groups by the actual billing cycle. This is the P1 feature that justifies building the app. All other features are table stakes expected by users of any finance dashboard.

See full analysis: `.planning/research/FEATURES.md`

**Must have (table stakes — v1 launch):**
- API integration layer (mock + real) — nothing else works without data; build with mock first
- Transaction list for bank accounts — core feature, date/merchant/amount/category, date-descending default
- Transaction list for credit cards — same fields plus card identifier and billing cycle grouping
- Dashboard overview — balance, income total, expense total; one-glance financial summary
- Credit card billing cycle display — statement date, cycle start/end, days until statement closes
- Billing cycle transaction grouping — CC transactions grouped by billing cycle, not calendar month (the differentiator)
- Date range filter — preset ranges (this week, this month, last month) plus custom; essential for all finance apps
- Account filter — view one account at a time; dropdown or tab
- Transaction text search — by merchant name and description
- Loading, error, and empty states — mandatory for any async data fetch; skeleton loading on transaction rows
- Responsive layout — mobile-first for transaction lists; dashboard grid collapses gracefully

**Should have (competitive — v1.x after validation):**
- Billing Cycle Summary Card — total spend this cycle + days until statement date at a glance
- Category breakdown chart — donut chart by category for current billing cycle using Recharts
- Spend vs. previous cycle comparison — "12% more than last cycle"; requires two full cycles of data
- Running balance display — account balance after each transaction
- Upcoming statement date highlight — "Statement closes in 3 days" visual badge
- Filter by transaction type (income/expense toggle)

**Defer (v2+):**
- Budget tracking — full data model, rollover logic, highest-complexity feature; validate demand first
- CSV/PDF export — low usage, maintenance surface; add only if explicitly requested
- Transaction category editing — diverges from API data, requires backend persistence for durability
- Notification/alert system — requires push infrastructure; out of scope for frontend-only

### Architecture Approach

The architecture is a 5-layer frontend: UI pages compose feature components which call feature hooks; hooks are the single coupling point between the API service layer and the UI; the API service layer abstracts transport behind domain-specific functions (`getTransactions()`, `getCreditCards()`); and MSW intercepts all calls in development via a single startup guard in `main.tsx`. Server state (API data) lives exclusively in TanStack Query's cache. Client state (filters, selected account, date range, search term, open panels) lives exclusively in Zustand. These two stores must never be mixed: this boundary is the most important architectural rule in the codebase and must be enforced from day one.

See full analysis: `.planning/research/ARCHITECTURE.md`

**Major components:**
1. Pages (`src/pages/`) — route-level containers; thin wrappers that compose feature components; import only from hooks, never from services
2. Feature components (`src/components/[feature]/`) — domain-specific UI (TransactionList, BillingCycleCard, SpendingChart); co-located by domain, isolated from each other
3. Feature hooks (`src/hooks/`) — business logic + data fetching; the only code that calls service functions; wrap TanStack Query; read Zustand store for filter params
4. Zustand stores (`src/store/`) — UI state only: filter values, pagination cursor, search string, selected account ID; never API data
5. API service layer (`src/services/`) — pure functions grouped by domain (accountsApi, transactionsApi, creditCardApi); all call through a single `apiClient.ts` instance; MSW intercepts in dev
6. Type definitions (`src/types/`) — single source of truth for all domain models; import everywhere; never redefine inline
7. Utility functions (`src/utils/`) — pure date math (billing cycle calculation), currency formatting, transaction grouping; separately testable, reusable

**Suggested build order (from ARCHITECTURE.md):**
Types → Mock fixtures + MSW handlers → API client + service modules → Zustand stores → Feature hooks → Shared components → Feature components → Pages → Real API wiring

### Critical Pitfalls

The 6 critical pitfalls identified span security, data integrity, architecture, and performance. All 6 have Phase 1 prevention points — meaning they cannot be deferred to later phases without significant refactor cost.

See full analysis: `.planning/research/PITFALLS.md`

1. **API called directly from browser / secret in VITE_ env vars** — API key is compiled into the JS bundle and visible in DevTools; real bank APIs often require server-side auth. Prevention: route authenticated calls through a serverless proxy (Netlify/Vercel function) that holds the secret; never use `VITE_API_KEY` for sensitive keys. Phase 1 must define the proxy strategy.

2. **Mock API contract diverges from real API schema** — mock built around UI assumptions; real API uses snake_case, string amounts, different conventions; discovered late when integration begins; requires full component rewrite. Prevention: read real API docs first; shape mock data to exactly match real API schema; use a typed adapter/mapper layer to transform API shape to UI shape.

3. **Floating-point arithmetic on currency values** — `0.1 + 0.2 = 0.30000000000000004` in financial totals; VND amounts are integers with no subunit and may arrive as strings from Vietnamese banking APIs. Prevention: define amount types as integers in Phase 1 TypeScript contracts; sum only integers; never perform arithmetic on raw floats; use `Intl.NumberFormat` at render layer only.

4. **Timezone confusion on statement dates and transaction timestamps** — API timestamps in UTC, statement cycle boundaries in Vietnam local time (UTC+7); `new Date("2025-12-15")` parses as midnight UTC, silently wrong; statement grouping fails only in UTC CI environments. Prevention: determine API timezone convention in Phase 1 and document it; use `date-fns-tz` with explicit `Asia/Ho_Chi_Minh` timezone for all statement cycle date parsing.

5. **Fetching all transactions without pagination on first load** — mock has 20-50 rows; production may have 2,000-5,000; initial load hangs, DOM renders 5,000 nodes, mobile scroll is unusable. Prevention: design API adapter interface with pagination params (`page`, `limit`) from day one even if initial implementation returns all; add `@tanstack/react-virtual` for list virtualization before adding features.

6. **Storing server data in Zustand / overengineered global state** — API response arrays pushed into Zustand, manual loading/error state dispatched via effects, cache invalidation written by hand; high-cost refactor if discovered late. Prevention: define the rule at project start — "API data lives in TanStack Query, user interaction state lives in Zustand" — and enforce it in code review.

## Implications for Roadmap

Based on the dependency graph, architectural build order, and pitfall phase-to-prevention mapping from all 4 research files, the following phase structure is recommended:

### Phase 1: Foundation and Data Infrastructure

**Rationale:** The dependency graph from FEATURES.md is unambiguous — every feature requires API data, and API data requires the service layer, type definitions, and mock API to exist first. Pitfalls 1-6 all have Phase 1 prevention points. None of the Phase 1 decisions are easily changed later without high refactor cost. This is the highest-leverage phase.

**Delivers:** Working data foundation — TypeScript domain types, Zod-validated API service layer, MSW mock API with realistic fixture data mirroring real API schema, Zustand filter stores, TanStack Query configuration with correct staleTime settings, and a single-page proof of a working data fetch → render pipeline.

**Addresses:** API integration (mock + real), TypeScript contracts for all domain models (Transaction, BankAccount, CreditCard, BillingCycle), server state vs. client state architectural boundary

**Avoids:** API secret exposure, mock-to-real schema mismatch, float arithmetic on currency, timezone confusion (establish conventions here), overengineered global state, pagination not designed in from start

**Research flag:** Needs `/gsd:research-phase` — the real third-party banking API (endpoint structure, authentication method, response schema, whether billing cycle data is available) must be verified before finalizing TypeScript types and mock fixtures. This is the highest-uncertainty point in the project.

### Phase 2: Core Transaction Views

**Rationale:** With the data layer in place, the transaction list and dashboard overview can be built with real data flowing through. FEATURES.md dependency graph shows these are independent of each other but both depend on Phase 1. ARCHITECTURE.md suggests building shared components before feature components.

**Delivers:** Transaction list for bank accounts with date/merchant/amount/category display, transaction list for credit cards, dashboard overview with account balances and income/expense totals, filter controls (date range, account, transaction type, text search), and all loading/error/empty states.

**Uses:** TanStack Query `useQuery` via feature hooks, Zustand filter stores, shadcn/ui components, Tailwind CSS, date-fns for relative date display, Intl.NumberFormat for VND currency formatting

**Implements:** TransactionList component, TransactionFilters component, TransactionSearch component, DashboardPage with BalanceSummary, shared LoadingSpinner/ErrorBoundary/EmptyState components

**Avoids:** Rendering all rows without virtualization (add `@tanstack/react-virtual`), non-explicit date formatting (use date-fns `format()` with `dd/MM/yyyy`, never `toLocaleDateString()`), full-page spinner (skeleton loading on individual data sections)

**Research flag:** Standard patterns; skip `/gsd:research-phase`. TanStack Query filter + pagination pattern is well-documented.

### Phase 3: Credit Card Billing Cycle Feature

**Rationale:** This is the product differentiator and the highest-complexity feature. It depends on Phase 2 (transaction list must exist) and requires the billing cycle date math utilities and statement date data from the API. It is isolated from the bank account features, making it a clean third phase. FEATURES.md flags billing cycle data availability as the single largest feature risk.

**Delivers:** Credit card billing cycle display (current cycle start/end, statement date, days until close), transactions grouped by billing cycle (not calendar month), BillingCycleCard component with period summary, and the statement cycle boundary date math utilities in `src/utils/formatDate.ts`.

**Uses:** date-fns 3.x (addMonths, setDate, differenceInDays, isBefore), date-fns-tz for timezone-explicit parsing of statement dates, billing cycle API data from Phase 1 mock fixtures

**Implements:** BillingCycleCard component, `groupTransactionsByBillingCycle()` utility, `getCurrentBillingCycle()` utility, CreditCardPage, useBillingCycles hook

**Avoids:** Billing cycle logic in JSX (keep in pure utils), new Date() without timezone on statement dates, confusing "transaction date" and "statement date" in the UI

**Research flag:** Needs API verification — confirm whether the third-party API returns `statementDate`, `billingCycleStart/End`, and `paymentDueDate`. If not, the fallback (user-configured cycle day) must be designed in this phase. The fallback decision point may need `/gsd:research-phase` depending on what the real API provides.

### Phase 4: Data Visualization and Polish

**Rationale:** Charts (category breakdown, spend vs. previous cycle comparison) depend on fully working transaction lists with correct billing cycle grouping. These are v1.x features per FEATURES.md and should not block the core product launch. Polish features (billing cycle summary card, upcoming statement date highlight, running balance) also belong here.

**Delivers:** Category breakdown donut chart (Recharts), spend vs. previous billing cycle comparison, Billing Cycle Summary Card, upcoming statement date visual indicator, and responsive layout verification across breakpoints.

**Uses:** Recharts 2.x for charts, `useMemo` for memoized chart data aggregation, React.memo on chart components to prevent re-animation on filter changes

**Implements:** SpendingChart component, CategoryBreakdown component, BillingCycleSummaryCard, responsive Tailwind grid breakpoints verified on mobile

**Avoids:** Chart libraries re-rendering on every transaction update (memoize chart data derivation), chart data computed inline in JSX (extract to hook or memo)

**Research flag:** Standard patterns; skip `/gsd:research-phase`. Recharts declarative API and Tailwind responsive breakpoints are well-documented.

### Phase 5: Real API Integration and Production Readiness

**Rationale:** The mock API was built to match the real API schema (Phase 1 enforced this), so real integration should be primarily configuration — swap base URL, wire authentication. This phase validates that assumption and addresses production-only concerns: CORS, security review, performance under real data volumes.

**Delivers:** Real API integration (replace MSW with actual banking API calls), CORS proxy setup if required, API key security audit (no keys in JS bundle), performance verification with real transaction volumes, Content Security Policy headers, and the "looks done but isn't" checklist from PITFALLS.md completed.

**Uses:** Actual third-party banking API, serverless proxy (Netlify/Vercel function) if CORS or auth requires it, `@tanstack/react-virtual` verified under real transaction count

**Implements:** Production API adapter, proxy function if needed, CSP meta tag, account number masking (last 4 digits only), no financial data in localStorage verification

**Avoids:** API key in VITE_ env vars, CORS proxy with Access-Control-Allow-Origin: * (restrict to production domain), financial data cached in localStorage

**Research flag:** May need `/gsd:research-phase` specifically for the proxy setup if the real API requires server-side OAuth or signed requests. Standard REST integration with Bearer token does not need additional research.

### Phase Ordering Rationale

- **Types before components** (Phase 1 → Phase 2): ARCHITECTURE.md build order is explicit — domain types must exist before any code that consumes them; this prevents refactoring component props when type shapes are discovered
- **Mock API before UI** (Phase 1): MSW handlers enable all UI development to proceed without real API dependency; avoids the "blocked by API team" problem that kills frontend velocity
- **Server-state architecture decided before first data fetch** (Phase 1): PITFALLS.md rates overengineered global state recovery as HIGH cost; the TanStack Query / Zustand boundary must be established in Phase 1 infrastructure, not discovered as a problem in Phase 3
- **Transaction lists before charts** (Phase 2 → Phase 4): Category charts depend on transaction data; you cannot verify chart correctness until transaction data and categorization are stable
- **Billing cycle after basic transactions** (Phase 2 → Phase 3): BillingCycleCard depends on TransactionList for CC transactions; building billing cycle display first would require building transaction list anyway
- **Real API last** (Phase 5): Mock was built to exactly mirror real API schema (Phase 1 enforced this); integration should be a configuration change, not a code rewrite; production-only concerns (CORS, CSP) are meaningless on localhost

### Research Flags

Needs `/gsd:research-phase` during planning:
- **Phase 1:** Real third-party banking API research — verify endpoint structure, authentication method (Bearer vs. OAuth), response schema (field names, data types, amount format), and whether billing cycle / statement date data is available on the API. This is the most critical unknown in the project.
- **Phase 5 (conditional):** Proxy setup research — if the real API requires server-side OAuth token exchange or signed requests, research the correct serverless proxy pattern for the chosen deployment platform (Netlify/Vercel/Cloudflare)

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 2:** TanStack Query filter + pagination with Zustand is a well-documented community pattern; shadcn/ui component integration is straightforward
- **Phase 3:** date-fns billing cycle arithmetic is deterministic; the pattern is defined in STACK.md and ARCHITECTURE.md
- **Phase 4:** Recharts declarative chart components and Tailwind responsive design are well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All library choices are well-reasoned from training data (Aug 2025 cutoff); React 19, TanStack Query v5, Zustand v4, shadcn/ui, Recharts 2.x, MSW 2.x, date-fns 3.x are all stable releases. WebFetch unavailable for current version verification — check shadcn/ui Tailwind 4 compatibility status before project start. |
| Features | MEDIUM | Analysis based on established competitors (Mint, Monarch Money, Copilot, Empower) and standard banking UX patterns. The billing cycle grouping differentiator is well-identified. Key gap: real API billing cycle data availability is unverified and is the single largest feature risk. |
| Architecture | MEDIUM | Patterns (TanStack Query / Zustand split, MSW adapter, feature hook layer) are established community conventions, not novel choices. HIGH confidence on the patterns themselves; MEDIUM because specific API integration pattern depends on unknown real API authentication method. |
| Pitfalls | MEDIUM-HIGH | CORS specification, IEEE 754 float behavior, and timezone parsing are specification-level facts (HIGH). Vietnamese banking API specific conventions (amount as integer string) rated LOW confidence — must verify against real API docs. Other pitfalls (mock-to-real mismatch, global state antipatterns) are MEDIUM — well-documented community patterns. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Real API billing cycle data:** The core differentiator (billing cycle grouping) depends on the third-party API returning `statementDate`, `billingCycleStart`, `billingCycleEnd`, and ideally `paymentDueDate`. This is unverified. Resolution: inspect actual API documentation before Phase 3 begins; design Phase 1 mock to include this data so Phase 3 is unblocked; plan user-configured cycle day as the fallback path.

- **Real API response schema:** Amount format (number vs. string), field naming convention (camelCase vs. snake_case), pagination pattern (offset/limit vs. cursor), and timestamp format (ISO 8601 UTC vs. local date strings) are all unknown for the real API. Resolution: read actual API documentation during Phase 1 research; build mock fixtures and Zod schemas to exactly match real API schema.

- **Authentication and CORS model:** Whether the real API supports browser direct calls with a Bearer token, or requires server-side authentication (OAuth flow, signed requests), determines whether a proxy is needed and how much production architecture complexity is introduced. Resolution: determine in Phase 1 research; if proxy is required, plan Phase 5 accordingly.

- **shadcn/ui + Tailwind 4 compatibility:** STACK.md notes that shadcn/ui's Tailwind 4 support was in progress as of early 2026. If Tailwind 4 is used, verify shadcn/ui compatibility before project initialization. If uncertain, use Tailwind 3.x (explicitly supported by shadcn/ui).

- **Vietnamese locale date formatting:** VND currency formatting with `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` may display differently across operating systems. PITFALLS.md flags this for explicit verification. Resolution: test VND output format during Phase 2 before relying on it for all currency display.

## Sources

### Primary (HIGH confidence)
- ECMAScript specification — IEEE 754 floating-point behavior (float arithmetic in JavaScript)
- ECMAScript Internationalization API — `Intl.NumberFormat` currency formatting behavior
- MDN Web Docs / Fetch Living Standard — CORS specification and browser enforcement
- date-fns 3.x documentation — billing cycle arithmetic functions

### Secondary (MEDIUM confidence)
- React 19 stable release (Dec 2024) — https://react.dev/blog
- TanStack Query v5 migration guide — https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5
- shadcn/ui component library — https://ui.shadcn.com/
- MSW 2.x documentation — https://mswjs.io/docs/
- Plaid API liabilities endpoint pattern — https://plaid.com/docs/liabilities/
- Industry analysis of Mint, Monarch Money, Copilot, Empower — established competitor feature patterns (training data Aug 2025)
- React ecosystem architectural conventions — TanStack Query / Zustand separation pattern (community consensus, documented in multiple architecture guides)

### Tertiary (LOW confidence)
- Vietnamese banking API response format (VND as integer string) — known from VND monetary convention (0 decimal places, ISO 4217); actual format varies by provider; must verify against real API docs
- Specific shadcn/ui + Tailwind 4 compatibility status (early 2026) — flagged in STACK.md as "in progress"; verify before project initialization

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
