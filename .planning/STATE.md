---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 11 context gathered
last_updated: "2026-03-09T00:35:20.073Z"
last_activity: 2026-03-09 — Plan 11-01 execution complete. ConversationStarters and tap-to-reveal UX enhancements with comprehensive test coverage.
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 53
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.
**Current focus:** Planning v1.1 — run /gsd:new-milestone to start

## Current Position

Phase: 11 of 5 (Chatbot UX Polish) — IN PROGRESS
Plan: 1 of 2 in current phase — COMPLETE (11-01: Conversation Starters & Mobile UX)
Status: Phase 10 Plan 02 completed. ExportButton component with filter integration, CSV download, and FilterBar integration. Phase 10 (CSV Export) now fully complete (2/2 plans).
Last activity: 2026-03-09 — Plan 10-02 execution complete. ExportButton wired to CSV export service with filter state capture and toast feedback.

Progress: [█████████░] 53% (9/17 plans completed)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 15.3 min (2.3 hours / 9 plans)
- Total execution time: 2.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 07-transaction-categories | 3/3 COMPLETE | 45 min | 15 min |
| 08-budget-tracking | 1/3 IN PROGRESS | ~1 hour | ~1 hour |
| 09-month-over-month-dashboard | 1/1 COMPLETE | 22 min | 22 min |
| 10-csv-export | 2/2 COMPLETE | 53 min | 26.5 min |
| 11-chatbot-ux-polish | 1/2 IN PROGRESS | 3 min | 3 min |

**Recent Trend:**
- Latest plan: 10-02 (8 min), 3 tasks, 9 new tests
- Trend: Efficient execution, focused enhancements, strong test coverage, no regressions

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 07 P01 | 12 min | 3 tasks | 6 files created |
| Phase 07 P02 | 23 min | 3 tasks | 4 created, 6 modified |
| Phase 07 P03 | 10 min | 3 tasks | 3 files modified |
| Phase 08 P01 | ~1 hour | 2 tasks | 5 files created |
| Phase 09 P01 | 22 min | 4 tasks | 3 created, 5 modified, 33 tests |
| Phase 10 P01 | 45 min | 3 tasks | 4 created, 2 modified, 16 tests |
| Phase 11 P01 | 3 min | 5 tasks | 3 created, 3 modified, 16 tests |
| Phase 10 P02 | 8 min | 3 tasks | 2 created, 2 modified, 9 tests |

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
- [Phase 06]: touch-target utility class established in index.css replacing inline min-h-[44px] min-w-[44px] pattern for WCAG AA compliance
- [Phase 06]: heading-label/body-sm utility classes applied for consistent typography scale across all UI components
- [Phase 06]: Node MSW server (setupServer) separate from browser worker (setupWorker) — test environment requires msw/node; src/mocks/server.ts is the test-only entry point
- [Phase 06]: Per-test QueryClient via createWrapper() with gcTime:0 + staleTime:0 — ensures no query cache leakage between tests
- [Phase 06]: jest-dom installed as devDep with setupFiles — toBeInTheDocument not in Vitest globals by default; test-setup.ts imports jest-dom + mocks scrollIntoView
- [Phase 06-04]: VITE_ENABLE_MSW=false set in vercel.json env block — explicit opt-out of MSW at Vercel build time
- [Phase 06-04]: main.tsx guards MSW with both import.meta.env.DEV AND VITE_ENABLE_MSW \!== 'false' — dual guard for production safety
- [Phase 06-04]: npm ci used in vercel.json installCommand for reproducible installs
- [Phase 09-01]: useQueries for parallel month fetching — superior to sequential useQuery calls; automatic loading state mgmt
- [Phase 09-01]: Delta calculation from existing /dashboard/stats endpoint (no new API calls) — cost-effective, leverages existing data structure
- [Phase 09-01]: Suppress delta with "Chưa đủ dữ liệu" when transactionCount < 5 — requirement DASH-V2-02, prevents misleading early-month trends
- [Phase 09-01]: Color semantics for delta: income (↑green, ↓red), expense (↑red, ↓green) — intuitive semantic feedback for users
- [Phase 10-02]: ExportButton self-contained via hooks (no props from FilterBar) — useFilterStore + useFilterParams for filter state capture
- [Phase 10-02]: accountId ?? cardId fallback for active account/card detection in export
- [Phase 10-02]: Generic error toast catch-all for network/validation export failures

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Real third-party banking API schema is unknown — mock fixtures must be built to match real API shape once documented. VND amount format (integer string vs number) must be verified.
- [Phase 3]: Billing cycle grouping depends on API returning statementDate/billingCycleStart/billingCycleEnd — if absent, a user-configured cycle day fallback must be designed.

## Session Continuity

Last session: 2026-03-09T12:00:00Z
Stopped at: Completed 10-02-PLAN.md (CSV Export phase complete)
Resume file: .planning/phases/10-csv-export/10-02-SUMMARY.md
