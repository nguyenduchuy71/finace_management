# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.
**Current focus:** Phase 1 — Foundation and Data Infrastructure

## Current Position

Phase: 1 of 4 (Foundation and Data Infrastructure)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-03 — Plan 01-02 complete: TypeScript domain types, Zod schemas, API service layer, currency + date utilities

Progress: [██░░░░░░░░] 17% (2/12 plans total)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 25 min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-data-infrastructure | 2/3 | 50 min | 25 min |

**Recent Trend:**
- Last 5 plans: 01-01 (35 min), 01-02 (15 min)
- Trend: Accelerating

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Real third-party banking API schema is unknown — mock fixtures must be built to match real API shape once documented. VND amount format (integer string vs number) must be verified.
- [Phase 3]: Billing cycle grouping depends on API returning statementDate/billingCycleStart/billingCycleEnd — if absent, a user-configured cycle day fallback must be designed.

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 01-02-PLAN.md — domain types, Zod schemas, API service layer, currency/date utilities complete
Resume file: None
