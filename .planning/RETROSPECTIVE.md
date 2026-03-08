# Retrospective

Living retrospective — updated after each milestone.

---

## Milestone: v1.0 — FinanceManager MVP

**Shipped:** 2026-03-04
**Phases:** 6 | **Plans:** 19 | **Timeline:** 2 days (2026-03-02 → 2026-03-04)

### What Was Built

1. Full frontend foundation — React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, MSW mock API with 70 bank + 59 CC Vietnamese fixture transactions
2. Complete transaction views — infinite-scroll bank transactions, CC transactions with pending/posted status, account switching tabs
3. Advanced filter & search — DateRangePicker, account/type filters, text search, all wired to TanStack Query auto-refetch via queryKey
4. Credit card billing cycle — UTC+7 boundary calculations, grouped transactions by cycle, BillingCycleInfoCard with countdown
5. Dashboard — income/expense stat cards, Recharts category donut/bar chart with memoized data, independent date picker
6. AI chatbot — Anthropic SDK streaming, multi-turn history, transaction context injection (up to 20 tx), react-markdown rendering, Ctrl+Shift+K shortcut
7. Production quality — code splitting, ≥70% Vitest coverage, WCAG AA touch targets, Vercel deployment with MSW guard

### What Worked

- **MSW deferred render guard** — enabled full UI development without a real API; zero hydration mismatches
- **Filter state in TanStack Query key** — eliminated all manual refetch triggers; filter changes just work
- **Zustand v5 double-curry pattern** — solved infinite re-render from the start; no fire-fighting later
- **Feature-based directory structure** — src/features/{accounts,transactions,creditCards,dashboard} kept concerns cleanly separated
- **Yolo mode** — fast iteration without confirmation gates; well-suited for solo personal projects
- **MSW node server for tests** — clean separation between browser worker and test server; no test pollution

### What Was Inefficient

- ROADMAP.md was not kept up-to-date with actual plan completion status (checkbox drift)
- REQUIREMENTS.md had unchecked items for shipped features — maintenance overhead not worth it for solo projects
- Phase 5.1 (Chatbot UI Refinements) was added to roadmap but never executed — added noise without value
- MILESTONES.md had a partial early entry (only 2 phases) that needed consolidation later

### Patterns Established

- `enableMocking().then(() => ReactDOM.createRoot(...))` — MSW deferred render guard (main.tsx)
- `create<State>()(() => ...)` — Zustand v5 double-curry for TypeScript inference
- `useShallow` on all object selectors in Zustand stores
- `getNextPageParam: (last) => last.nextCursor ?? undefined` — TanStack Query v5 cursor pattern
- `Date.UTC(y, m, d, 17, 0, 0)` — Vietnam UTC+7 billing cycle boundary constant
- `lazy(() => import(...).then(m => ({ default: m.Component })))` — named export lazy loading
- `VITE_ENABLE_MSW !== 'false'` dual guard for MSW production safety

### Key Lessons

1. **Lock QueryClient config in Phase 1** — staleTime/gcTime/retry decisions made early prevent refactoring pain across every hook
2. **Use `undefined` not `null` for TanStack Query sentinels** — null stops pagination silently; undefined is the v5 contract
3. **Apply useShallow from day 1** — retroactive addition requires touching every Zustand consumer
4. **UTC boundary constants, not runtime calculations** — billing cycle logic that runs per-render must be a constant, not a new Date() call
5. **Import defineConfig from vitest/config, not vite** — TypeScript strict mode will fail otherwise; easy to get wrong
6. **dangerouslyAllowBrowser: true is intentional** — Anthropic API supports browser CORS; the flag is an explicit opt-in, not a risk
7. **Keep ROADMAP.md checkbox-accurate** — drift between roadmap and reality makes progress reporting unreliable

### Cost Observations

- Profile: balanced (sonnet for execution, inherit for planning)
- Sessions: ~6 sessions across 2 days
- All 19 plans executed without rollback
- Notable: Phase 2 took the most plans (5) because it included the most user-facing complexity

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 6 |
| Plans | 19 |
| Timeline | 2 days |
| LOC | ~7,478 |
| Rollbacks | 0 |
| Yolo mode | Yes |
