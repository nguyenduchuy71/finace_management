---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 06-01 (Code Splitting & Bundle Optimization). Ready for 06-02 Lighthouse audit.
last_updated: "2026-03-04T13:14:31.851Z"
last_activity: 2026-03-04 — Plan 06-01 complete (5 tasks). Bundle optimized: 1,223KB -> 525KB (-57%), 10 JS chunks, zero TypeScript errors.
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 19
  completed_plans: 16
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.
**Current focus:** Phase 6 — Optimize & Deploy

## Current Position

Phase: 6 of 7 (Optimize & Deploy) — IN PROGRESS
Plan: 1 of 4 in current phase — COMPLETE (06-01: Code Splitting & Bundle Optimization)
Status: Plan 06-01 complete — Vite manualChunks for recharts/anthropic/markdown; React.lazy() route lazy-loading; Recharts lazy in DashboardPage; Anthropic SDK lazy in useChatApi. Build: 525KB main (from 1,223KB), 10 JS chunks, zero warnings, zero TypeScript errors.
Last activity: 2026-03-04 — Plan 06-01 complete (5 tasks, 4 files). Bundle reduced 57%, code splitting verified.

Progress: [████████░░] 84% (16/19 plans total)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 18 min
- Total execution time: 1.46 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-data-infrastructure | 3/3 COMPLETE | 70 min | 23 min |
| 02-core-transaction-views | 3/4 IN PROGRESS | 17 min | 16 min |

**Recent Trend:**
- Last 5 plans: 01-03 (20 min), 02-01 (15 min), 02-02 (15 min), 02-03 (2 min), —
- Trend: Stable

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 35 min | 2 tasks | 13 files |
| Phase 01 P02 | 15 min | 2 tasks | 12 files |
| Phase 01 P03 | 20 min | 2 tasks | 7 files |
| Phase 02 P01 | 18 min | 6 tasks | 24 files |
| Phase 02 P02 | 15 min | 6 tasks | 7 files |
| Phase 02 P03 | 2 min | 8 tasks | 8 files |
| Phase 02 P04 | 5 min | 4 tasks | 4 files |
| Phase 02 P05 | 3 min | 8 tasks | 8 files |
| Phase 03 P01 | 8 min | 2 tasks | 3 files |
| Phase 03-credit-card-billing-cycle P02 | 3 | 5 tasks | 4 files |
| Phase 04 P01 | 3 min | 3 tasks | 11 files |
| Phase 04-dashboard-and-polish P02 | 12 | 2 tasks | 5 files |
| Phase 05-chatbot-integration P01 | 4 | 3 tasks | 5 files |
| Phase 05-chatbot-integration P02 | 5 | 2 tasks | 1 files |
| Phase 06-optimize-and-deploy P01 | 22 | 5 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Frontend-only, React + TypeScript, no backend
- [Setup]: Mock API (MSW) first — build UI without real API dependency
- [Phase 1]: TanStack Query for server state, Zustand for UI state — boundary must be enforced from Phase 1, high refactor cost if mixed
- [01-01]: QueryClient locked config — staleTime=5min, gcTime=10min, retry=2, refetchOnWindowFocus=false
- [01-01]: Tailwind CSS v4 CSS-first configuration (no tailwind.config.js), tw-animate-css for animations
- [01-01]: shadcn/ui New York style with default color scheme; @/ alias pointing to src/
- [01-01]: MSW deferred render guard pattern (enableMocking().then() wraps ReactDOM.createRoot)
- [01-02]: Import defineConfig from 'vitest/config' not 'vite' — vite's defineConfig doesn't include test property in strict TypeScript
- [01-02]: formatVND uses Intl.NumberFormat('vi-VN') + digit-only regex extraction — platform-safe, immune to OS symbol variation
- [01-02]: Zod schemas export both schema constant and z.infer<> type for dual runtime+compile-time use
- [01-02]: Service functions call PaginatedResponseSchema(ItemSchema).parse() at Zod boundary for all API responses
- [01-03]: useShallow required for object selectors in Zustand v5 — without it every render creates new object reference, triggering infinite re-render
- [01-03]: Filter state in TanStack Query key — queryKey includes all Zustand filter params so any filter change auto-triggers re-fetch
- [01-03]: mockTransactions sorted globally descending by transactionDate — combines both account arrays and sorts once at export time
- [02-01]: useInfiniteQuery returns undefined (not null) as getNextPageParam sentinel — TanStack Query v5 requirement
- [02-01]: TransactionFilters interface lives in accounts.ts and is imported by creditCards.ts to avoid circular deps
- [02-01]: MSW credit card income filter returns empty array — CC transactions are always expenses by design
- [02-01]: useDebounced uses setTimeout/clearTimeout cleanup — no external debounce lib needed
- [02-02]: Apply dark class to document.documentElement immediately on module load to prevent FOUC
- [02-02]: AppShell as layout route so AppHeader renders once and all child pages share the same layout without re-mounting on navigation
- [02-02]: Route / redirects to /accounts with Navigate replace to avoid back-button trap
- [02-02]: Theme persisted to localStorage under finance-theme key
- [02-03]: DateRangePicker auto-closes Popover only when both from AND to dates selected — single-date click keeps popover open for second selection
- [02-03]: FilterBar resetFilters() resets all filter state including accountId/cardId defaults — acceptable since FilterBar is mounted within account-specific page contexts
- [02-04]: CreditCardTabs uses card.cardName + card.cardNumber.slice(-4) — confirmed from CreditCard type (cardNumber field, not lastFour)
- [02-04]: AccountTabs initializes accountId to first account only when accountId is null — avoids overriding existing store state on navigation back
- [02-05]: chatStore API config persists to localStorage; message history does not — page-refresh clears chat per CONTEXT.md decision
- [02-05]: useChatApi caps transaction context at 20 items to prevent LLM token overflow; filter state included in context text
- [02-05]: ChatPanel mobile bottom sheet (max-h-85vh) + desktop side panel (380x520px sm: breakpoint)
- [02-05]: OpenAI-compatible POST format with Vietnamese system prompt for transaction analysis
- [03-01]: 17:00 UTC = midnight VN (UTC+7) as billing cycle boundary constant — all cycle start/end timestamps use Date.UTC(y, m, statementDay, 17, 0, 0)
- [03-01]: subDays applied to endVN (not endUTC) to produce inclusive last calendar day for display
- [03-01]: Pending txs (no billingCycleStart) assigned to currentCycle.startISO key in groupTransactionsByCycle — enables single-pass Map grouping
- [03-01]: ISO string localeCompare for newest-first cycle sort — no Date construction needed for descending UTC ISO order
- [Phase 03-credit-card-billing-cycle]: useCreditCards returns PaginatedResponse<CreditCard> directly (useQuery not useInfiniteQuery) — access active card via cardsData?.data.find()
- [Phase 03-credit-card-billing-cycle]: BillingCycleInfoCard urgency variants: destructive <=3 days, secondary <=7 days, default otherwise — matches alert patterns used elsewhere in app
- [04-01]: Dashboard uses independent dashboardStore (not filterStore) — users can compare dashboard period to transaction list period without switching views
- [04-01]: MSW /api/dashboard/stats includes all CC statuses (pending + posted) — pending CC transactions are real spending commitments
- [04-01]: DashboardDatePicker uses native inputs on mobile (sm:hidden) and Calendar popover on desktop (hidden sm:flex) for touch-friendly UX
- [Phase 04-02]: recharts 3.7.0 installed (latest); CategoryChart Card has no col-span — parent wrapper owns grid placement; AppHeader mobile abbreviation 'Thẻ TD' applied proactively; useMemo dep [categoryBreakdown] only
- [Phase 05-chatbot-integration]: ApiConfig shape changed from {endpoint,apiKey} to {apiKey,model} — Anthropic SDK handles endpoint internally; ChatSettings updated to model selector
- [Phase 05-chatbot-integration]: Keyboard shortcut useEffect placed before early return so Ctrl+Shift+K works when ChatPanel is closed
- [Phase 05-chatbot-integration]: react-markdown renders assistant messages with Tailwind prose classes; no remark/rehype plugins needed for v1
- [Phase 05-chatbot-integration]: localStorage persistence in chatStore: saveMessages() called as side-effect in every set() mutation for messages
- [Phase 05-chatbot-integration]: ChatSettings removed endpoint field — Anthropic SDK handles routing internally; only apiKey + model needed in ApiConfig
- [Phase 05-chatbot-integration]: Xoa API key button conditionally visible when apiConfig exists — avoids confusing delete action on empty state
- [Phase 05-chatbot-integration]: Anthropic SDK dangerouslyAllowBrowser: true — browser CORS allowed by Anthropic API as of 2025; explicit opt-in flag
- [Phase 05-chatbot-integration]: Typing indicator pattern over token streaming — isLoading=true + finalMessage() avoids chatStore modification for partial-text streaming updates
- [Phase 06-optimize-and-deploy]: esbuild used as Vite minifier (terser not installed) — equivalent tree-shaking for this project
- [Phase 06-optimize-and-deploy]: Main bundle 525KB accepted — React/TanStack/shadcn shared deps cannot be split without loading waterfalls
- [Phase 06-optimize-and-deploy]: React.lazy() with named export re-export pattern: lazy(() => import(...).then(m => ({ default: m.Component })))

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Real third-party banking API schema is unknown — mock fixtures must be built to match real API shape once documented. VND amount format (integer string vs number) must be verified.
- [Phase 3]: Billing cycle grouping depends on API returning statementDate/billingCycleStart/billingCycleEnd — if absent, a user-configured cycle day fallback must be designed.

## Session Continuity

Last session: 2026-03-04T13:14:31.847Z
Stopped at: Completed 06-01 (Code Splitting & Bundle Optimization). Ready for 06-02 Lighthouse audit.
Resume file: None
