# Milestones

## v1.0 — FinanceManager MVP (Shipped: 2026-03-04)

**Phases completed:** 6 phases, 19 plans
**Timeline:** 2026-03-02 → 2026-03-04 (2 days)
**Codebase:** ~7,478 LOC TypeScript/TSX

**Key accomplishments:**
1. Full frontend foundation — React 19 + TypeScript strict + Tailwind CSS v4 + shadcn/ui + MSW mock API with Vietnamese banking fixture data
2. Complete transaction viewing — bank transactions (infinite-scroll), credit card transactions (pending/posted), account switching via tabs
3. Advanced filtering & search — date range picker, account/type filters, text search, all wired to TanStack Query auto-refetch
4. Credit card billing cycle — Vietnam UTC+7 boundary calculations, grouped transactions by cycle, statement countdown card
5. Dashboard overview — income/expense stat cards, Recharts donut/bar chart, independent date picker, responsive mobile layout
6. AI chatbot — Anthropic SDK with streaming, transaction context injection, chat persistence, Ctrl+Shift+K shortcut, markdown rendering
7. Production quality — code splitting, ≥70% Vitest coverage, WCAG AA touch targets, Vercel deployment with MSW production guard

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
