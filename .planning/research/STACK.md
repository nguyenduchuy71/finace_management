# Stack Research

**Domain:** Frontend-only personal finance dashboard
**Researched:** 2026-03-02
**Confidence:** MEDIUM (training data through Aug 2025; Context7/WebFetch unavailable — versions flagged where uncertain)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | React 19 is the stable release as of late 2024; Concurrent features, Server Components (not used here but future-proof), large ecosystem, and exactly what the project already specifies |
| TypeScript | 5.4+ | Type safety | Strict typing prevents runtime errors when mapping API response shapes to UI; finance apps demand data correctness — a wrong balance display is a bug |
| Vite | 5.x | Build tool + dev server | 10-100x faster HMR than CRA/webpack for React + TS projects; native ESM, excellent plugin ecosystem; CRA is unmaintained |
| TanStack Query (React Query) | 5.x | Server state / API data fetching | Handles loading/error/stale states automatically; built-in request deduplication and caching; the correct tool when your state is primarily remote API data — this project is 100% API-driven |
| Zustand | 4.x | Client UI state | Lightweight (< 1kb), minimal boilerplate for UI-only state (selected account, active date filter, search term); does not replace TanStack Query |
| React Router | 6.x | Client-side routing | Standard SPA routing; v6 has clean nested route API for dashboard → account detail → transaction drill-down views |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | 0.8+ (components, not semver) | UI component primitives | Use as the base component system — copy-owned components built on Radix UI + Tailwind; avoids opinionated design lock-in from MUI or Ant; ideal for a dashboard that wants to own its look |
| Radix UI | (via shadcn) | Accessible primitive components | Headless components with ARIA compliance baked in; used under shadcn automatically |
| Tailwind CSS | 3.x | Utility-first styling | Co-located styles, no CSS file sprawl, excellent with shadcn; Tailwind 4 alpha exists but v3 is production stable |
| Recharts | 2.x | Charts (line, bar, pie) | Built on D3 but React-native; declarative API; best choice for time-series spending trends, monthly category breakdowns, and balance over time; largest React chart ecosystem |
| date-fns | 3.x | Date math and formatting | Functional, tree-shakeable, no mutation; critical for credit card statement cycle arithmetic (days-since-cutoff, days-until-due, cycle boundaries); use date-fns over moment.js (deprecated) or dayjs (smaller but less comprehensive) |
| clsx + tailwind-merge | latest | Conditional class merging | Required when building conditional Tailwind class strings; prevents class conflicts; standard pattern with shadcn |
| axios | 1.x | HTTP client for API calls | Better than raw fetch for interceptors (auth headers, global error handling, retry logic); useful for the third-party API integration layer |
| msw (Mock Service Worker) | 2.x | Mock API during development | Intercepts real HTTP requests at the network level — the project explicitly requires mock API for dev; MSW 2.x works in both browser and Node (Vitest); far better than hardcoded mock data |
| zod | 3.x | API response validation + type inference | Parse and validate third-party API responses at the boundary; derive TypeScript types from schemas (`z.infer`); prevents type lies when the API shape differs from expectation |
| Vitest | 1.x | Unit testing | Native Vite integration, same config as production build; use for testing data transformation logic (transaction categorization, cycle calculations) |
| React Testing Library | 14.x | Component testing | Test UI from user perspective; pair with Vitest |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Build tool + dev server | `npm create vite@latest -- --template react-ts`; configure `vite.config.ts` with path aliases (`@/` → `src/`) from day one |
| ESLint + eslint-plugin-react-hooks | Linting | Enforce hooks rules; catches stale closure bugs which are common in dashboard filter state |
| Prettier | Code formatting | Zero-config; integrate with ESLint via `eslint-config-prettier` |
| TypeScript strict mode | Type safety | `"strict": true` in `tsconfig.json`; enables `strictNullChecks`, `noImplicitAny`; non-negotiable for finance data handling |
| Husky + lint-staged | Pre-commit hooks | Run ESLint + Prettier before commit; keeps codebase clean without manual enforcement |

---

## Installation

```bash
# Bootstrap project
npm create vite@latest finace-management -- --template react-ts
cd finace-management

# Core runtime dependencies
npm install react-router-dom @tanstack/react-query zustand axios date-fns zod clsx tailwind-merge

# Charts
npm install recharts

# UI - shadcn/ui (CLI-based installation)
npx shadcn@latest init
# Follow prompts: New York style, Slate base color, CSS variables: yes

# Dev dependencies
npm install -D tailwindcss postcss autoprefixer @types/node
npm install -D msw vitest @testing-library/react @testing-library/user-event jsdom
npm install -D eslint eslint-plugin-react-hooks @typescript-eslint/eslint-plugin prettier eslint-config-prettier
npm install -D husky lint-staged

# Initialize Tailwind
npx tailwindcss init -p
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite | Create React App (CRA) | Never — CRA is officially deprecated and unmaintained since 2023 |
| Vite | Next.js | Only if you add SSR, SSG, or API routes; pure frontend dashboards don't need Next.js overhead |
| TanStack Query v5 | SWR | SWR is simpler but fewer features; TanStack Query is better for complex cache invalidation across multiple accounts/cards |
| Zustand | Redux Toolkit | Redux adds significant boilerplate for UI-only state like filter selections; use Redux only if team > 5 or state is very complex |
| Zustand | Jotai | Jotai uses atom model (bottom-up); fine for simple state, but Zustand's store model is more predictable for dashboard UI state with interdependent filters |
| shadcn/ui + Tailwind | Material UI (MUI) | MUI if team prefers Material Design aesthetic or needs pre-built data grid components; shadcn gives more control |
| shadcn/ui + Tailwind | Ant Design | Ant Design if building enterprise-facing B2B app; too heavy for personal dashboard, opinionated styling hard to override |
| Recharts | Chart.js + react-chartjs-2 | Chart.js is canvas-based and harder to style with Tailwind; Recharts SVG-based components are more composable in React |
| Recharts | Victory | Victory is fine but smaller ecosystem and less frequent updates; Recharts has more community examples |
| Recharts | Tremor | Tremor has beautiful defaults and is Tailwind-native, but it bundles Recharts internally — use Recharts directly for more control |
| date-fns | dayjs | dayjs is smaller (2kb vs 13kb) but less comprehensive for complex date math; statement cycle boundary calculations need full date-fns power |
| date-fns | Luxon | Luxon is excellent but heavier; date-fns tree-shakes to near-zero for only the functions you use |
| date-fns | moment.js | Do NOT use — moment.js is in maintenance mode, mutable, and 67kb |
| axios | fetch API (native) | Use raw fetch only if you have no need for interceptors; once you need auth headers on every request to the third-party API, axios interceptors are cleaner |
| msw | json-server | MSW intercepts real HTTP calls in the browser — no proxy server needed; json-server requires running a separate process |
| zod | io-ts | zod has much better TypeScript integration and ergonomics; io-ts requires functional programming knowledge |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Deprecated since 2023, no active maintenance, slow builds | Vite with react-ts template |
| moment.js | Mutable API, 67kb unminified, officially in maintenance mode | date-fns 3.x |
| Redux (classic) | Excessive boilerplate for UI state in a personal dashboard | Zustand for UI state, TanStack Query for server state |
| Chart.js / react-chartjs-2 | Canvas-based, imperative API, poor Tailwind integration, harder to SSR | Recharts (SVG-based, declarative, React-native) |
| react-query v3 | Outdated; v5 API is significantly cleaner with TypeScript; v3 reaches EOL | TanStack Query v5 |
| Emotion / styled-components | CSS-in-JS runtime cost, not needed when using Tailwind + shadcn | Tailwind CSS utility classes |
| MobX | Overkill for this project; observation model adds complexity without benefit | Zustand |
| Ant Design | Heavy bundle, opinionated styles difficult to override, not ideal for finance dashboard aesthetics | shadcn/ui + Tailwind |

---

## Stack Patterns by Variant

**If the third-party API requires OAuth or token refresh:**
- Add `axios` interceptors for token injection and 401 retry
- Store token in memory (not localStorage) for security; use Zustand for token state
- Because finance API tokens should never persist in localStorage

**If the third-party API has a Plaid/Teller-style Link flow:**
- Add `react-plaid-link` or the provider's official React SDK
- Because these flows require their own iframe/modal component

**If transaction volume is large (> 1000 per load):**
- Add `@tanstack/react-virtual` for virtualized transaction lists
- Because rendering 1000+ DOM rows kills scroll performance on mobile

**If you need Excel/CSV export:**
- Add `xlsx` (SheetJS community edition) or `papaparse` for CSV
- Because finance users frequently want to export data for tax purposes

**If offline support is needed (unlikely given scope):**
- Add `workbox` + service worker
- Because this is a read-only display app; offline is not in project scope

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| React 19.x | TanStack Query 5.x | Full compatibility; TQ5 uses React 18+ concurrent features |
| React 19.x | Recharts 2.x | Compatible; Recharts 2.x targets React 16+ |
| React 19.x | Radix UI (via shadcn) | Compatible; Radix updated for React 18/19 |
| TanStack Query 5.x | React 18+ | Minimum React 18 required for TQ5 |
| Tailwind 3.x | shadcn/ui | shadcn explicitly targets Tailwind 3.x; Tailwind 4 support in shadcn is in progress as of early 2026 |
| date-fns 3.x | TypeScript 5.x | Full compatibility; v3 includes built-in types |
| msw 2.x | Vite 5.x | Compatible; MSW 2.x supports Vite's dev server via `http` interceptor |
| zod 3.x | TypeScript 5.x | Full compatibility; zod 3 is the stable release |

---

## Architecture Notes for This Stack

### Server State vs Client State Split

This is the most important architectural decision for a finance dashboard:

- **TanStack Query** owns: transaction lists, account balances, credit card details, statement data — everything that comes from the API
- **Zustand** owns: selected account filter, date range filter, search term, active tab, modal open/close state — everything that is local UI

Do NOT put API data into Zustand. Do NOT put UI state into TanStack Query. This split eliminates 80% of state management bugs.

### API Response Boundary

Validate ALL third-party API responses with Zod schemas at the service layer boundary:

```typescript
// src/services/accounts.ts
import { z } from 'zod'

const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.string().datetime(),
  description: z.string(),
  category: z.string().optional(),
})

type Transaction = z.infer<typeof TransactionSchema>

export async function fetchTransactions(accountId: string): Promise<Transaction[]> {
  const response = await axios.get(`/api/accounts/${accountId}/transactions`)
  return z.array(TransactionSchema).parse(response.data)
}
```

### Date Handling for Statement Cycles

Credit card statement cycles require careful date arithmetic. date-fns provides the correct primitives:

```typescript
import { addMonths, setDate, isBefore, differenceInDays } from 'date-fns'

function getStatementCycle(cutoffDay: number, referenceDate = new Date()) {
  const thisMonthCutoff = setDate(referenceDate, cutoffDay)
  const cycleStart = isBefore(referenceDate, thisMonthCutoff)
    ? setDate(addMonths(referenceDate, -1), cutoffDay)
    : thisMonthCutoff
  const cycleEnd = isBefore(referenceDate, thisMonthCutoff)
    ? thisMonthCutoff
    : setDate(addMonths(referenceDate, 1), cutoffDay)
  return { cycleStart, cycleEnd, daysUntilCutoff: differenceInDays(cycleEnd, referenceDate) }
}
```

### Mock API Setup (MSW)

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/accounts', () => {
    return HttpResponse.json({ accounts: mockAccounts })
  }),
  http.get('/api/accounts/:id/transactions', ({ params }) => {
    return HttpResponse.json({ transactions: mockTransactions })
  }),
]
```

Enable in `main.tsx` during development:

```typescript
if (import.meta.env.DEV) {
  const { worker } = await import('./mocks/browser')
  await worker.start()
}
```

---

## Sources

- Training data (Aug 2025 cutoff) — React 19, Vite 5, TanStack Query 5, Zustand 4, date-fns 3, zod 3, shadcn/ui, Recharts 2, MSW 2 — MEDIUM confidence (Context7/WebFetch unavailable for current verification)
- React official changelog: https://react.dev/blog — React 19 stable released Dec 2024
- TanStack Query v5 migration guide: https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5 — v5 breaking changes documented
- shadcn/ui: https://ui.shadcn.com/ — component copy model, Radix + Tailwind
- MSW 2.x: https://mswjs.io/docs/ — browser and Node interception
- date-fns 3.x: https://date-fns.org/ — functional date utilities, tree-shakeable

---

*Stack research for: Personal finance management dashboard (frontend-only)*
*Researched: 2026-03-02*
