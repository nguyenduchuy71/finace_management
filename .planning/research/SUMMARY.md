# Project Research Summary

**Project:** FinanceManager v1.1 — Smart Insights & Polish
**Domain:** Frontend-only personal finance dashboard (Vietnamese market, React SPA)
**Researched:** 2026-03-08
**Confidence:** HIGH — research grounded in direct codebase inspection, not generic advice

## Executive Summary

FinanceManager v1.1 adds five features to an already-shipped v1.0 foundation: transaction category classification, monthly budget tracking, month-over-month dashboard comparison, chatbot UX polish, and CSV export. The existing stack (React 19, Zustand v5, TanStack Query v5, Tailwind v4, shadcn/ui, MSW v2) covers 95% of what v1.1 needs. Only one new npm dependency is required — `papaparse` for correct CSV serialization of Vietnamese text with commas — plus one new shadcn component (`progress`) added via CLI. Everything else reuses established patterns already in the codebase.

The recommended build order is dictated by a single hard dependency: Transaction Categories must be built first because Budget Tracking groups spending by category. Every other feature is independent and can be built in any order after Categories. The architecture is purely additive — new stores (`categoryStore`, `budgetStore`), new pure utility functions (`categories.ts`, `export.ts`), and surgical modifications to existing components. No existing patterns are broken; no backend changes are needed; MSW mock handlers handle the development environment throughout.

The primary risk area is correctness in two domains: (1) date boundary calculations for month-over-month comparisons, which must account for the Vietnam UTC+7 offset already established in the codebase, and (2) CSV export completeness, which must fetch all transactions via a dedicated service call rather than reading only the infinite-scroll loaded pages from cache. Both are well-understood problems with clear solutions documented in the research. A secondary risk is Zustand v5 selector correctness — the `useShallow` pattern established in v1.0 must be followed precisely in every new store, or infinite re-render loops will result.

## Key Findings

### Recommended Stack

The v1.0 stack is locked and fully capable. v1.1 requires only: `papaparse@^5.5.3` (+ `@types/papaparse`) for CSV serialization, and `npx shadcn add progress` for budget progress bars. All other needs are already met.

**New dependencies for v1.1:**
- `papaparse@^5.5.3`: CSV serialization — Vietnamese descriptions contain commas; naive CSV builders produce broken Excel files; `Papa.unparse()` handles all edge cases; ~24KB bundle cost is justified
- `@types/papaparse` (devDep): TypeScript types — updated Dec 2025 on DefinitelyTyped

**Shadcn components to add via CLI (no new npm deps):**
- `progress`: Budget progress bars — `npx shadcn@latest add progress`; uses `@radix-ui/react-progress` which is already a transitive dep

**What NOT to add:**
- `xlsx` / SheetJS — 800KB bundle for a CSV-only feature
- `react-csv` — effectively abandoned (last published 2021)
- `@tanstack/react-virtual` — 70–130 transactions do not require virtualization
- Any ML/NLP library — rule-based categorization is sufficient and deterministic

**Existing stack coverage for v1.1:**
- Zustand v5 `persist` middleware: budget limits and category overrides (same localStorage pattern as `chatStore.ts`)
- TanStack Query v5: two parallel `useQuery` calls for month-over-month (no new caching library needed)
- date-fns v4 + @date-fns/tz v1: month boundary calculations with Vietnam UTC+7 timezone awareness
- lucide-react: `TrendingUp`, `TrendingDown`, `ArrowUp`, `ArrowDown` already imported in `StatCard.tsx`
- sonner: `toast.warning()` for budget threshold alerts (already installed)
- shadcn/ui `Select`, `Badge`, `Button`: all present in `src/components/ui/`

### Expected Features

**Must have (v1.1 table stakes):**
- Auto-classify expense transactions by category (merchant-name regex rules) — users expect zero manual entry for standard merchants
- Category badge visible on every expense transaction row — instant visual scan of spending type
- User can override any category inline (one-click popover, not modal) — persists to localStorage by transaction ID
- Vietnamese merchant recognition by default: Grab, Shopee, MoMo, Circle K, Highlands, VinMart, AEON, etc.
- Monthly budget per category with progress bar — green/amber/red threshold states (0–74%, 75–99%, 100%+)
- Yellow warning at 80%, red at 100%+ — early warning, not post-mortem
- Month-over-month delta on income/expense stat cards with directional arrow + percentage
- CSV export of filtered transactions with UTF-8 BOM — non-negotiable for Windows + Excel (primary Vietnamese user setup)
- Conversation starters in empty chat (4 Vietnamese-language prompts tied to app data context)

**Should have (v1.2 — build after validation):**
- "Apply override to all same-merchant" bulk action — only if override fatigue is reported
- Sparkline trend charts (3-month) — needs real API with history
- Absolute VND delta on hover alongside percentage delta

**Defer (v2+):**
- Savings goal tracking — distinct from spending limits
- PDF export — large dependency (jsPDF, html2canvas); out of scope
- Predictive spending ("you'll exceed budget by end of month") — needs 3+ months real data
- Custom category creation — 6 fixed categories match Money Lover/Money Keeper conventions

**Anti-features confirmed (do not build):**
- ML/LLM per-transaction classification — API cost per transaction, latency on list render, overkill for ~100 tx/month
- Income transactions should not show category badges — categories apply to expenses only
- Chat history persistence across sessions — stale financial context; privacy risk on shared devices
- Budget rollover — complicates mental model; static monthly reset matches how Vietnamese users think about bills
- Budget push notifications — requires service worker; visual dashboard alert is sufficient

**Vietnamese market specifics:**
- Fixed 6 expense categories matching Money Lover/Money Keeper: Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Khác
- UTF-8 BOM (`'\uFEFF'`) is non-negotiable — Windows + Excel is the primary spreadsheet environment
- Monthly budget mental model (not weekly) — aligns with Vietnamese billing cycle conventions
- Emoji category icons match local app conventions for instant user familiarity
- VND amounts as raw integers in CSV (not formatted strings) — Excel needs numeric values for SUM formulas

### Architecture Approach

v1.1 is purely additive to the existing feature-based directory structure. Two new Zustand stores follow the established manual-localStorage pattern from `chatStore.ts`. Two new pure utility modules have no React dependencies and are trivially unit-testable. The `useDashboardStats` hook gains a parallel second query for the previous period. All other modifications are surgical prop additions or child component insertions with no existing contract breakage.

**New files to create:**
1. `src/utils/categories.ts` — `resolveCategory()` pure function + `CATEGORY_LABELS` + `MERCHANT_CATEGORY_MAP` + `VALID_CATEGORIES` constant
2. `src/utils/export.ts` — `transactionsToCsv()` pure function (Vietnamese headers, VND integers, RFC 4180 escaping)
3. `src/stores/categoryStore.ts` — user overrides keyed by transaction ID, manual localStorage persist
4. `src/stores/budgetStore.ts` — monthly limits as `Partial<Record<ValidCategory, number>>`, Zod-validated on load
5. `src/hooks/useExport.ts` — dedicated service call (NOT cache read) + Blob download trigger
6. `src/features/dashboard/BudgetProgress.tsx` — single category: shadcn Progress + inline number input
7. `src/features/dashboard/BudgetSection.tsx` — container for all BudgetProgress rows, sibling to CategoryChart
8. `src/features/chatbot/ConversationStarters.tsx` — 4 clickable prompt chips (pre-fill only, no auto-send)
9. `src/components/filters/CategoryFilter.tsx` — shadcn Select bound to `filterStore.categoryId`

**Files modified (surgical changes):**
- `filterStore.ts` — add `categoryId: string|null` + `setCategory` action (additive; existing consumers unaffected)
- `useDashboardStats.ts` — add parallel previous-period query with distinct key prefix `['dashboardStats', 'prev', ...]`
- `StatCard.tsx` — add optional `delta?` + `deltaPercent?` props (additive with defaults; existing renders unchanged)
- `TransactionRow.tsx` + `CreditCardTransactionRow.tsx` — add `<CategoryBadge>` after merchant name
- `FilterBar.tsx` — add `<CategoryFilter>` + `<ExportButton>` (may need `flex-wrap` for mobile layout)
- `DashboardPage.tsx` — add `<BudgetSection>` below chart grid; pass `previousData` to StatCards
- `ChatPanel.tsx` — replace hardcoded empty-state JSX with `<ConversationStarters onSelect={...}>`
- `src/utils/dates.ts` — add `getPreviousPeriod()` and `getCalendarMonthBoundaries()` exports
- `mocks/handlers.ts` — update `/dashboard/stats` to return date-aware filtered sums for previous-period queries

**Key architectural boundaries to preserve:**
- `dashboardStore` must remain independent from `filterStore` — this is an intentional v1.0 UX decision
- `BudgetSection` must be a sibling component to `CategoryChart`, never a child — prevents chart re-animation on budget keystrokes
- `categoryStore` and `budgetStore` must use Zustand v5 double-curry `create<T>()()` — not v4 single-curry
- CSV export uses a dedicated `getTransactionsForExport(limit=1000)` service call — never `pages.flatMap()` from infinite query cache

### Critical Pitfalls

1. **useShallow selector includes action functions** — Zustand v5 `useShallow` comparing a function reference causes infinite re-render loop. Actions must be accessed via separate non-shallow selectors. Follow `filterStore.ts` lines 43–53 exactly. Verify with React DevTools Profiler after creating each new store.

2. **CSV export reads only infinite-scroll loaded pages** — `pages.flatMap()` silently exports only what the user has scrolled to. Must use a dedicated `getTransactionsForExport()` service call with `limit=1000`, called outside TanStack Query. Test by filtering to >20 transactions and verifying CSV row count equals API total.

3. **Month-over-month date boundaries drift by UTC+7** — `new Date(y, m, 1).toISOString()` produces wrong UTC boundary for Vietnam timezone. Use `Date.UTC(y, m-1, 1) - 7*3600*1000` pattern in `getCalendarMonthBoundaries()`. Write and unit-test this utility before building any delta UI; test December, January-to-February, and February-to-March boundaries explicitly.

4. **Budget store keys mismatch API category strings** — progress bars show 0% if localStorage uses Vietnamese display labels instead of API slugs (`food`, `transport`, etc.). Define `VALID_CATEGORIES` as a typed const in `src/utils/categories.ts`. Type budget store as `Partial<Record<ValidCategory, number>>`. Add Zod deserialization that strips invalid keys on localStorage load.

5. **CategoryChart memoization broken by budget store subscription** — chart animation replays on every budget field keystroke if any budget state subscription exists inside `CategoryChart`'s subtree. Keep `BudgetSection` as a separate grid row below the chart. Also replace `data?.categoryBreakdown ?? []` at `DashboardPage.tsx` line 83 with a module-scope `const EMPTY_BREAKDOWN: CategoryBreakdownItem[] = []` to stabilize the `useMemo` dependency.

6. **Conversation starters auto-send before apiConfig loads** — React 19 strict mode double-invokes effects; `chatStore` null-config guard persists an error message to localStorage. Starters must pre-fill `ChatInput` field only — never `useEffect` auto-send. The user must explicitly press Enter.

7. **Previous-period query fires when dateFrom is null** — `dashboardStore` starts with `dateFrom: null`. Gate both the previous-period query and all delta UI with `enabled: Boolean(dateFrom && dateTo)`. Use distinct key prefix `['dashboardStats', 'prev', ...]` to avoid cache collision with current-period query.

## Implications for Roadmap

The dependency graph is clear. The phase structure follows it directly, with Categories as the only non-negotiable first step.

### Phase 1: Transaction Categories

**Rationale:** Hard prerequisite for Budget Tracking — budgets group spending by category, so categories must exist first. Also establishes `VALID_CATEGORIES` constant, `categoryStore` localStorage pattern, and `filterStore.categoryId` addition that all other phases build on. The only MEDIUM-complexity item in v1.1; front-load it.

**Delivers:** Auto-classification of all expense transactions, category badge on transaction rows, user override via one-click popover (persists to localStorage), category filter dropdown in FilterBar, `utils/categories.ts` and `categoryStore.ts` as shared infrastructure.

**Addresses features:** CAT-01 (auto-classify), CAT-02 (user override), CAT-03 (category filter)

**Avoids pitfalls:** Pitfall 1 (useShallow with actions — establish pattern here), Pitfall 2 (classifier on null merchantName — run against full fixture immediately), Pitfall 4 (budget key mismatch — define `VALID_CATEGORIES` here before budget store exists)

**First action before writing code:** Confirm the exact category strings in `src/mocks/handlers.ts` lines 149–159 `categoryBreakdown`. The `VALID_CATEGORIES` set must match what the API returns, not assumed values.

**Research flag:** Standard patterns — no additional research needed. Merchant map + `resolveCategory()` is a pure TypeScript pattern. Unit test classifier against all 70 bank + 59 CC fixture transactions before wiring to any component.

### Phase 2: Budget Tracking

**Rationale:** Requires Phase 1's `VALID_CATEGORIES` and the category classification infrastructure. Reuses existing `useDashboardStats` `categoryBreakdown` data — no new API calls or MSW handler changes needed. After Categories, this is the highest user value feature for the lowest remaining implementation cost.

**Delivers:** `budgetStore` with Zod-validated localStorage persistence, `BudgetProgress` (progress bar + inline input) and `BudgetSection` (container) components on Dashboard, green/amber/red threshold states, inline budget editing (blur/enter to save), total budget summary row.

**Addresses features:** BUDGET-01 (budget storage), BUDGET-02 (progress bars on dashboard), BUDGET-03 (threshold alerts via sonner toast.warning)

**Avoids pitfalls:** Pitfall 4 (use `VALID_CATEGORIES` from Phase 1 for store typing), Pitfall 5 (keep `BudgetSection` as sibling grid row below `CategoryChart`, not inside it)

**Pre-check:** Verify `src/components/ui/progress.tsx` exists. If absent: `npx shadcn@latest add progress`.

**Research flag:** Standard patterns — Zustand localStorage pattern is documented and proven by `chatStore.ts`. No additional research needed.

### Phase 3: Month-over-Month Dashboard

**Rationale:** Fully independent of Categories and Budget. Placed after Phase 2 to avoid simultaneous edits to `DashboardPage.tsx`. The date utility work here is the most technically precise task in v1.1 and benefits from dedicated focus.

**Delivers:** `getPreviousPeriod()` and `getCalendarMonthBoundaries()` utilities in `src/utils/dates.ts` (with unit tests covering all boundary cases), parallel previous-period query in `useDashboardStats` with distinct cache key, delta props on `StatCard`, delta arrows hidden when no date range is selected, MSW `/dashboard/stats` handler updated to return date-aware filtered sums.

**Addresses features:** DASH-V2-01 (delta on income/expense stat cards), DASH-V2-02 (delta on category breakdown)

**Avoids pitfalls:** Pitfall 3 (UTC+7 boundary drift — `getCalendarMonthBoundaries()` must be written and tested first), Pitfall 7 (null dateFrom guard — `enabled: Boolean(dateFrom && dateTo)`), layout shift from two queries settling at different times (use `placeholderData` or show skeleton until both queries settle)

**First action before writing code:** Verify current MSW `/dashboard/stats` handler behavior — does it return static aggregated totals regardless of date params, or does it already filter by date? This determines the handler update scope.

**Research flag:** Careful implementation required — date boundary logic for UTC+7 is a known subtle correctness issue that won't surface in casual browser testing. Unit test all edge cases (December→January, January→February 28/29 days, February→March) in a UTC environment (`TZ=UTC npx vitest`) before wiring to UI.

### Phase 4: CSV Export

**Rationale:** Fully independent of all other features. Placed after Phase 3 to avoid concurrent FilterBar edits — Phase 1 already added `CategoryFilter`; this phase adds `ExportButton` to the same FilterBar. The architectural decision (dedicated fetch vs. cache read) must be locked in first; it cannot be changed without breaking data completeness.

**Delivers:** `src/utils/export.ts` (pure function, unit tested with Vietnamese edge cases), dedicated `getTransactionsForExport()` in `src/services/accounts.ts` (limit=1000, no cursor, no TanStack Query caching), `src/hooks/useExport.ts` (calls service + Blob download), Export button in FilterBar, UTF-8 BOM, Vietnamese column headers, VND as raw integers, date-range-contextual filename.

**Addresses features:** EXP-01 (export currently filtered transactions), EXP-02 (UTF-8 BOM, Vietnamese characters, meaningful filename)

**Avoids pitfalls:** Pitfall 6 (dedicated fetch not `pages.flatMap` — lock this in as Phase 4's first decision), UX pitfall (generic filename — include filter date range in filename)

**First action before writing code:** Define `getTransactionsForExport(accountId, filters, limit=1000)` signature in `src/services/accounts.ts` and commit it before building any UI. This prevents the cache-read antipattern from being introduced under time pressure.

**Research flag:** Standard patterns — Blob download via native Web API is well-documented. papaparse `Papa.unparse()` usage is straightforward. No additional research needed.

### Phase 5: Chatbot UX Polish

**Rationale:** Fully independent of all other features. Lowest regression risk — makes a safe final step. Verify what is already done before writing any new code; `ChatMessage.tsx` copy button, regenerate, and delete actions are already confirmed implemented.

**Delivers:** `ConversationStarters.tsx` component with 4 Vietnamese-language prompts that pre-fill (never auto-send) `ChatInput`, improved message bubble visual polish, cleaner empty state, starters reappear after chat clear.

**Addresses features:** CHAT-UX-01 (conversation starters), CHAT-UX-02 (copy feedback — likely already done), CHAT-UX-03 (visual polish)

**Avoids pitfalls:** Pitfall 6 variant (auto-send before apiConfig loads — pre-fill only, never `useEffect` send), iOS Safari clipboard requirement (call `clipboard.writeText()` only inside `onClick`, never in `setTimeout`)

**Pre-check:** Read `ChatMessage.tsx` fully and confirm copy button behavior before writing any code. Most of CHAT-UX-02 may already be complete. Audit `ChatSettings.tsx` for what polish is actually needed vs. already present.

**Research flag:** No research needed — pure React + Tailwind work on existing components with known patterns.

### Phase Ordering Rationale

- **Categories first** is the only non-negotiable ordering constraint. Budget Tracking depends on `VALID_CATEGORIES` and `categoryStore`. No other dependency is hard.
- **Budget second** while Categories context is fresh in the codebase. Avoids re-opening `DashboardPage.tsx` after Month-over-Month adds its dashboard edits.
- **Month-over-Month third** is self-contained but benefits from Categories and Budget already settling `DashboardPage.tsx` before adding delta UI to the same page.
- **CSV Export fourth** keeps FilterBar modifications sequential: Categories adds the filter dropdown in Phase 1, Export adds the button in Phase 4.
- **Chatbot last** has zero cross-feature dependencies and zero risk of breaking any data flow.

### Research Flags

**Phases needing careful implementation verification (not additional research):**
- **Phase 1 (Categories):** Confirm `categoryBreakdown` key strings in handlers.ts before defining `VALID_CATEGORIES`. Run classifier unit test against full 70-transaction fixture before wiring to any component.
- **Phase 3 (Month-over-Month):** Write and unit-test `getCalendarMonthBoundaries()` before building delta UI. Check MSW handler date-filtering behavior before modifying it.
- **Phase 4 (CSV Export):** Lock in `getTransactionsForExport()` as a dedicated service function as Phase 4's first commit. Verify export row count equals API total, not loaded pages count.

**Phases with fully standard patterns (implement directly):**
- **Phase 2 (Budget):** Zustand localStorage pattern mirrors `chatStore.ts`. shadcn `progress` is a CLI add.
- **Phase 5 (Chatbot):** Audit existing `ChatMessage.tsx` first — most work may already be done.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct `package.json` and source file inspection; papaparse version confirmed via search (npm page returned 403 but search results concordant) |
| Features | HIGH | v1.1 features validated against live codebase; Vietnamese market conventions confirmed via Money Lover/Money Keeper competitor analysis |
| Architecture | HIGH | Every component boundary and data flow pattern mapped to specific source files with line references; no speculation |
| Pitfalls | HIGH | Every pitfall maps to a specific line of existing code (e.g., `filterStore.ts` line 43, `DashboardPage.tsx` line 83); not generic React advice |

**Overall confidence:** HIGH

### Gaps to Address

- **papaparse version pinning**: npm page returned 403 during research; v5.5.3 confirmed via search results but not directly verified on registry. Pin to `^5.5.3`, run `npm install`, and verify `package-lock.json` after install before proceeding.

- **MSW handler date filtering**: The current `/dashboard/stats` handler was inspected structurally but not runtime-tested. Month-over-Month phase must begin by verifying actual handler behavior: does it compute period-specific totals from fixture data based on date params, or return static aggregated sums? If static, update the handler before building any delta UI.

- **`categoryBreakdown` category key set**: Research identified a risk that fixture data uses both `'food'` and `'dining'` as separate keys. The exact set returned by `src/mocks/handlers.ts` lines 149–159 must be confirmed by direct inspection before defining `VALID_CATEGORIES`. Do not assume — read the handler.

- **iOS Safari clipboard**: The existing `ChatMessage.tsx` copy button may or may not invoke `clipboard.writeText()` directly inside `onClick`. Verify this before marking CHAT-UX-02 complete; iOS Safari requires the clipboard API to be called within a user gesture handler.

## Sources

### Primary — HIGH confidence (direct codebase inspection)
- `src/stores/filterStore.ts` lines 43–53 — useShallow selector pattern, Zustand v5 double-curry
- `src/stores/chatStore.ts` lines 38–73, 82 — localStorage persistence pattern, apiConfig null guard
- `src/stores/dashboardStore.ts` — null dateFrom/dateTo initial state
- `src/features/dashboard/CategoryChart.tsx` lines 36–47, 84–96 — CATEGORY_LABELS, useMemo comment and `?? []` risk
- `src/hooks/useDashboardStats.ts` — queryKey shape `['dashboardStats', { dateFrom, dateTo }]`
- `src/hooks/useTransactions.ts` — infinite query key shape, undefined sentinel pattern
- `src/features/chatbot/useChatApi.ts` lines 41, 47–54 — pages.flatMap pattern, apiConfig guard
- `src/mocks/handlers.ts` line 41 — date comparison `tx.transactionDate >= dateFrom`; lines 149–159 — category aggregation
- `src/mocks/fixtures/transactions.ts` — merchant names, category strings, income transactions without merchantName
- `src/types/account.ts` line 19 — `merchantName: z.string().optional()`
- `src/pages/DashboardPage.tsx` line 83 — `data?.categoryBreakdown ?? []` fallback
- `src/features/chatbot/ChatMessage.tsx` lines 18–24, 101–125 — copy/regenerate/delete already implemented
- `package.json` — locked stack versions

### Secondary — MEDIUM confidence (WebSearch verification)
- papaparse v5.5.3 — confirmed via search results (npm page returned 403)
- `@types/papaparse` — updated Dec 2025 on DefinitelyTyped
- shadcn/ui `progress` component — confirmed on ui.shadcn.com docs; uses `@radix-ui/react-progress`
- Zustand `persist` middleware v5 double-curry pattern — confirmed across multiple concordant sources
- UTF-8 BOM `'\uFEFF'` for Excel CSV — widely documented, RFC 4180 standard approach

### Tertiary — MEDIUM confidence (market/competitor research)
- Money Lover, Money Keeper Vietnamese app conventions — 6-category structure with emoji icons
- Nielsen Norman Group: Prompt controls in GenAI chatbots — conversation starters UX pattern
- Eleken, G&Co. fintech UX best practices — budget progress bar threshold conventions (80%/100%)
- B-Company, FintechNews SG — Vietnamese market context (Windows + Excel primary spreadsheet tool)

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
