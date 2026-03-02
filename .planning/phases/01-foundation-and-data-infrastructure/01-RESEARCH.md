# Phase 1: Foundation and Data Infrastructure - Research

**Researched:** 2026-03-02
**Domain:** React + TypeScript SPA scaffolding, MSW mock API, TanStack Query v5, Zustand v5, Zod v4, VND currency formatting
**Confidence:** HIGH (verified against official sources and Context7 where available)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mock Data Richness**
- 2 bank accounts (e.g., Vietcombank checking + Techcombank saving)
- 2 credit cards (e.g., Techcombank Visa + VPBank Mastercard)
- 30–50 transactions per account, spanning the last 3 months
- Real Vietnamese merchant names: Circle K, Grab, Shopee, Bách Hoá Xanh, Điện Máy Xanh, etc.
- Both income and expense transactions, mix of pending/posted for credit cards
- Billing cycle data: statement date on the 15th, due date on the 5th of the following month

**API Response Contract**
- Amount: **integer** (VND has no decimal — ISO 4217)
- Field naming: **camelCase** (TypeScript frontend standard)
- Timestamps: **ISO 8601 UTC** (`"2026-01-15T00:00:00Z"`), convert to UTC+7 for display
- Pagination: **cursor-based** (`nextCursor: string | null`, `limit: number`)
- Response envelope: `{ data: T[], nextCursor: string | null, total: number }`
- Error shape: `{ code: string, message: string, details?: unknown }`

**Project Structure**
- **Feature-based** under `src/features/`
  - `src/features/accounts/` — bank accounts
  - `src/features/transactions/` — transaction lists + filters
  - `src/features/creditCards/` — CC + billing cycle
  - `src/features/dashboard/` — overview + charts
- Shared primitives at `src/components/ui/` (shadcn components)
- Shared hooks at `src/hooks/`
- API service layer at `src/services/`
- Zod schemas + TypeScript types at `src/types/`
- MSW handlers at `src/mocks/`
- Zustand stores at `src/stores/`

**Error Handling Strategy**
- **Inline error states** in each data component (not global)
- Error component: icon + message + retry button
- Toast (shadcn Sonner) only for transient errors (network timeout, etc.)
- TanStack Query retry: 2 automatic retries before showing error state
- Loading: skeleton placeholder (not full-page spinner)

### Claude's Discretion
- Exact Zod schema fields (will be derived from mock data shape)
- MSW handler implementation details
- Tailwind config tweaks
- shadcn component selection for base UI primitives

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Project initialized with Vite + React 19 + TypeScript strict mode + Tailwind CSS + shadcn/ui | Vite 6 react-ts template → shadcn `npx shadcn@latest init` with Tailwind v4 (now default); strict tsconfig pattern documented |
| FOUND-02 | Mock API set up with MSW 2.x, returning realistic bank and credit card transaction data | MSW 2.x browser integration: `npx msw init ./public --save` + `setupWorker` + deferred app render; handlers use `http` + `HttpResponse` |
| FOUND-03 | API service layer with Zod schema validation for all third-party API responses | Zod v4 stable (Aug 2025); breaking changes from v3 documented; `z.infer<>` type derivation pattern verified |
| FOUND-04 | TanStack Query v5 configured for server state (transactions, accounts, statements) | TanStack Query v5 setup: `QueryClientProvider`, `staleTime`/`gcTime`, removed `onSuccess`/`onError` from `useQuery` — use `useEffect` instead |
| FOUND-05 | Zustand store configured for UI state (filters, active tab, search query) | Zustand v5.0.11 stable; TypeScript double-curry `create<T>()()` required; `useShallow` required for object selectors |
| UX-02 | VND amounts formatted as `đ 1.500.000` (no decimals, `Intl.NumberFormat` vi-VN) | `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` outputs `1.500.000 ₫` — symbol position and character vary by OS; custom format function required to match `đ 1.500.000` exactly |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete data plumbing for the application — no visible UI beyond a proof-of-concept transaction row, but every subsequent phase depends on what gets built here. The stack is React 19 + Vite 6 + TypeScript strict mode + Tailwind CSS (v4, now the default in shadcn) + shadcn/ui, with MSW 2.x for mock API, TanStack Query v5 for server state, Zustand v5 for UI state, Zod v4 for API response validation, and date-fns v4 + `@date-fns/tz` for timezone-aware date handling.

Several library major versions have advanced since the domain research was done in early 2026: Zod is now at v4 (released August 2025, breaking changes from v3 are significant — especially string format validators and error shape), date-fns is now at v4 (minimal breaking changes from v3, but timezone support now ships as `@date-fns/tz` rather than `date-fns-tz`), Zustand is now at v5 (requires `create<T>()()` double curry for TypeScript and `useShallow` for object selectors), and shadcn/ui now defaults to Tailwind v4. The planner must use these current versions.

The two most critical Phase 1 decisions that cannot be changed cheaply later are: (1) the TanStack Query / Zustand data ownership boundary — API data lives in TanStack Query cache only, never in Zustand; and (2) the VND amount type as `number` (integer) everywhere in TypeScript, never as string or float, with `Intl.NumberFormat` formatting applied only at the render layer.

**Primary recommendation:** Scaffold with `npm create vite@latest -- --template react-ts`, then layer in dependencies in the order: TypeScript types → Zod schemas → MSW handlers + fixtures → axios apiClient → TanStack Query setup → Zustand stores → proof-of-concept render. This build order ensures every layer can be tested as soon as it is written.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 6.x | Build tool + dev server | React 19 template, native ESM, fastest HMR; CRA deprecated since 2023 |
| React | 19.x | UI framework | Stable Dec 2024; concurrent features; locked decision |
| TypeScript | 5.x | Static typing | Strict mode required; finance data demands correctness |
| TanStack Query | 5.x | Server state (API data) | Handles caching, deduplication, stale/loading/error automatically; locked decision |
| Zustand | 5.x | UI state (filters, search, active tab) | v5.0.11 stable; lightweight; locked decision |
| MSW | 2.x | Mock API | Network-level interception in browser; no conditional URLs in components |
| Zod | 4.x | API response validation + type inference | v4 stable Aug 2025; 14x faster parsing; `z.infer<>` derives TypeScript types |
| axios | 1.x | HTTP client | Request/response interceptors for auth headers and error normalization |
| date-fns | 4.x | Date arithmetic | Functional, tree-shakeable; billing cycle math; v4 has first-class timezone support |
| @date-fns/tz | latest | Timezone support for date-fns v4 | Replaces `date-fns-tz`; provides `TZDate` + `tz()` helper |
| shadcn/ui | latest | UI components (copy-owned) | Radix primitives + Tailwind; locked decision |
| Tailwind CSS | 4.x | Utility-first styling | Now the default in shadcn/ui init |
| clsx + tailwind-merge | latest | Conditional class merging | Required for shadcn component patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query-devtools | 5.x | TanStack Query browser devtools | Dev only; attach to QueryClientProvider |
| React Router DOM | 6.x | Client-side routing | Phase 1 sets up BrowserRouter; routes added in Phase 2+ |
| Vitest | 1.x | Unit testing | Native Vite integration; for util functions (currency format, date math) |
| @testing-library/react | 14.x | Component tests | Pair with Vitest for integration testing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind v4 + shadcn | Tailwind v3 + shadcn legacy | v3 works via shadcn legacy docs but v4 is now the shadcn default; new projects should use v4 |
| Zustand v5 | Zustand v4 | v4 still works but v5 is stable and recommended; v5 drops `use-sync-external-store` dep |
| Zod v4 | Zod v3 | v3 import path still works via `"zod/v3"` subpath during transition; use v4 for new projects |
| @date-fns/tz | date-fns-tz | `date-fns-tz` was the third-party companion; `@date-fns/tz` is the official v4 replacement |
| axios | native fetch | axios if you need interceptors for auth headers (this project will); fetch if purely simple requests |

**Installation:**

```bash
# 1. Scaffold project
npm create vite@latest finace-management -- --template react-ts
cd finace-management

# 2. Core runtime dependencies
npm install @tanstack/react-query @tanstack/react-query-devtools zustand axios date-fns @date-fns/tz zod clsx tailwind-merge react-router-dom

# 3. shadcn/ui (Tailwind v4, React 19 — now the default)
npx shadcn@latest init
# Choose: New York style, Slate base, CSS variables: yes

# 4. Dev dependencies
npm install -D msw vitest @testing-library/react @testing-library/user-event jsdom

# 5. Generate MSW service worker
npx msw init ./public --save
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── ui/              # shadcn copy-owned primitives (Button, Card, Skeleton, etc.)
├── features/
│   ├── accounts/        # Bank account components + hooks
│   ├── transactions/    # Transaction list + filter components + hooks
│   ├── creditCards/     # Credit card + billing cycle components + hooks
│   └── dashboard/       # Overview + charts components + hooks
├── hooks/               # Shared hooks (not feature-specific)
├── mocks/
│   ├── browser.ts       # MSW browser worker setup
│   ├── handlers.ts      # All MSW request handlers
│   └── fixtures/        # Typed mock data (accounts, transactions, creditCards)
│       ├── accounts.ts
│       ├── transactions.ts
│       └── creditCards.ts
├── services/
│   ├── apiClient.ts     # Axios instance with base URL + interceptors
│   ├── accounts.ts      # getAccounts(), getTransactions() — calls apiClient
│   └── creditCards.ts   # getCreditCards(), getStatements()
├── stores/
│   └── filterStore.ts   # Zustand: dateRange, accountId, cardId, search, txType
├── types/
│   ├── account.ts       # BankAccount, Transaction domain types
│   ├── creditCard.ts    # CreditCard, BillingCycle, CreditCardTransaction types
│   └── api.ts           # PaginatedResponse<T>, ApiError shared types
├── utils/
│   ├── currency.ts      # formatVND() — Intl.NumberFormat wrapper
│   └── dates.ts         # toVietnamTime(), formatDisplayDate()
├── App.tsx              # QueryClientProvider + Toaster wrapper
└── main.tsx             # MSW guard → ReactDOM.createRoot render
```

### Pattern 1: MSW Browser Integration (Deferred Render)

**What:** MSW service worker must be registered and awaited before the app renders to prevent a race condition where initial queries fire before the worker intercepts them.

**When to use:** Always — this is the only correct pattern for MSW 2.x in Vite.

**Example:**

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

async function enableMocking() {
  // CRITICAL: use import.meta.env.DEV (Vite) not process.env.NODE_ENV
  if (!import.meta.env.DEV) return
  const { worker } = await import('./mocks/browser')
  // Return the Promise — await before render
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
```

### Pattern 2: MSW Handler with Cursor Pagination

**What:** MSW handlers use `http` + `HttpResponse` from `msw`. Query params must NOT be in the URL path pattern — read them from `request.url`.

**When to use:** All paginated endpoints (transactions list).

**Example:**

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'
import { mockTransactions } from './fixtures/transactions'

export const handlers = [
  http.get('/api/accounts/:accountId/transactions', ({ params, request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? '20')

    const allTx = mockTransactions.filter(
      (tx) => tx.accountId === params.accountId
    )
    const startIndex = cursor ? allTx.findIndex((tx) => tx.id === cursor) + 1 : 0
    const page = allTx.slice(startIndex, startIndex + limit)
    const nextCursor = startIndex + limit < allTx.length
      ? page[page.length - 1]?.id ?? null
      : null

    return HttpResponse.json({
      data: page,
      nextCursor,
      total: allTx.length,
    })
  }),
]
```

### Pattern 3: Zod v4 Schema + Type Derivation

**What:** Define Zod schemas at the API boundary; derive TypeScript types from them. Use `z.infer<>` so types are always in sync with the schema.

**Critical Zod v4 changes from v3:**
- `z.string().email()` → `z.email()` (moved to top-level)
- `z.string().uuid()` → `z.uuid()`
- `error.errors` → `error.issues` in ZodError
- Error customization: `message` option → `error` option

**Example:**

```typescript
// src/types/account.ts
import { z } from 'zod'

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number().int(),          // VND: integer always
  description: z.string(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),  // ISO 8601 UTC
})

export type Transaction = z.infer<typeof TransactionSchema>

export const PaginatedTransactionSchema = z.object({
  data: z.array(TransactionSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
})

// src/services/accounts.ts
import axios from 'axios'
import { apiClient } from './apiClient'
import { PaginatedTransactionSchema } from '../types/account'

export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20
) {
  const response = await apiClient.get(
    `/accounts/${accountId}/transactions`,
    { params: { cursor, limit } }
  )
  // Parse validates at boundary — throws ZodError if shape is wrong
  return PaginatedTransactionSchema.parse(response.data)
}
```

### Pattern 4: TanStack Query v5 Setup

**What:** v5 removes `onSuccess`/`onError`/`onSettled` callbacks from `useQuery`. Use `useEffect` on `isError`/`isSuccess` instead. `cacheTime` was renamed to `gcTime`.

**Example:**

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes — finance data is not real-time
      gcTime: 1000 * 60 * 10,     // 10 minutes cache retention
      retry: 2,                    // Matches locked decision: 2 retries before error
      refetchOnWindowFocus: false, // Personal finance dashboard, not live feed
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* app routes here */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

// Feature hook pattern
import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '../services/accounts'
import { useFilterStore } from '../stores/filterStore'

export function useTransactions(accountId: string) {
  const { dateFrom, dateTo } = useFilterStore()

  return useQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo }],
    queryFn: () => getTransactions(accountId),
    enabled: Boolean(accountId),
  })
}
```

### Pattern 5: Zustand v5 Filter Store

**What:** Zustand v5 requires `create<T>()()` double curry for TypeScript. Object selectors require `useShallow` to prevent infinite re-renders.

**Example:**

```typescript
// src/stores/filterStore.ts
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

interface FilterState {
  accountId: string | null
  cardId: string | null
  dateFrom: string | null
  dateTo: string | null
  searchQuery: string
  txType: 'all' | 'income' | 'expense'
  setAccountId: (id: string | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  setSearchQuery: (q: string) => void
  setTxType: (type: FilterState['txType']) => void
  resetFilters: () => void
}

const defaultState = {
  accountId: null,
  cardId: null,
  dateFrom: null,
  dateTo: null,
  searchQuery: '',
  txType: 'all' as const,
}

export const useFilterStore = create<FilterState>()((set) => ({
  ...defaultState,
  setAccountId: (accountId) => set({ accountId }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTxType: (txType) => set({ txType }),
  resetFilters: () => set(defaultState),
}))

// When consuming multiple fields from the store — MUST use useShallow
// to prevent re-render on every store update
export function useFilterParams() {
  return useFilterStore(
    useShallow((state) => ({
      accountId: state.accountId,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      searchQuery: state.searchQuery,
      txType: state.txType,
    }))
  )
}
```

### Pattern 6: VND Currency Formatting

**What:** `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` outputs `1.500.000 ₫` — the symbol is `₫` (U+20AB) and appears after the number on most platforms. The locked decision requires `đ 1.500.000` (symbol before, space after, dot separators). Build a custom wrapper.

**Example:**

```typescript
// src/utils/currency.ts

/**
 * Format an integer VND amount as "đ 1.500.000"
 * Uses Intl.NumberFormat for locale-correct grouping but normalises
 * the symbol position and character to match the locked UX decision.
 *
 * @param amount - Integer VND amount (no decimals)
 */
export function formatVND(amount: number): string {
  // vi-VN uses dots as thousand separators and no decimal places for VND
  const formatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

  // Intl output may be "1.500.000 ₫" or "1.500.000 ₫" (trailing symbol)
  // Normalize: strip trailing ₫ or ₫, prepend "đ "
  const numberPart = formatted
    .replace(/\s*[₫đ]\s*/g, '')
    .trim()

  return `đ ${numberPart}`
}

// For negative amounts (expenses): "- đ 500.000"
export function formatVNDSigned(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '- ' : ''
  return `${sign}${formatVND(abs)}`
}
```

### Pattern 7: Timezone-Aware Date Display

**What:** API timestamps are ISO 8601 UTC. All display must convert to UTC+7 (Asia/Ho_Chi_Minh). Use `@date-fns/tz` (date-fns v4 official companion — replaces `date-fns-tz`).

**Example:**

```typescript
// src/utils/dates.ts
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

const VN_TZ = 'Asia/Ho_Chi_Minh'

/**
 * Parse a UTC ISO string and return a TZDate in Vietnam timezone.
 * Use this for all transaction date display.
 */
export function toVietnamDate(isoUtcString: string): TZDate {
  return new TZDate(isoUtcString, VN_TZ)
}

/**
 * Format a UTC ISO timestamp for display: "15/01/2026"
 */
export function formatDisplayDate(isoUtcString: string): string {
  return format(toVietnamDate(isoUtcString), 'dd/MM/yyyy')
}

/**
 * Format with time: "15/01/2026 14:30"
 */
export function formatDisplayDateTime(isoUtcString: string): string {
  return format(toVietnamDate(isoUtcString), 'dd/MM/yyyy HH:mm')
}
```

### Anti-Patterns to Avoid

- **`new Date("2026-01-15")` without TZDate:** Parses as midnight UTC, displays as "14/01/2026" in UTC+7. Always use `toVietnamDate()`.
- **`process.env.NODE_ENV` in Vite:** Use `import.meta.env.DEV` instead — `process.env` is not available in Vite by default.
- **Query params in MSW URL pattern:** `http.get('/api/transactions?limit=20')` does NOT work — MSW issues a warning and will not intercept. Read query params from `new URL(request.url).searchParams`.
- **Putting API data in Zustand:** Any array of Transaction or Account objects in a Zustand store is wrong. Those belong in TanStack Query cache.
- **Using `onSuccess`/`onError` in `useQuery`:** Removed in TanStack Query v5. Use `useEffect` watching `data`/`error` instead.
- **`z.string().email()` or `z.string().uuid()` in Zod v4:** These are deprecated. Use `z.email()` and `z.uuid()` top-level functions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API response caching | Custom cache object in Zustand | TanStack Query | Handles stale time, background refetch, deduplication, memory management automatically |
| Loading / error state per-query | Manual `isLoading`, `error` useState | TanStack Query `isLoading`, `isError`, `error` | Every custom loading state misses edge cases (background refetch, stale-while-revalidate) |
| Mock API server | json-server or conditional fetch URLs | MSW 2.x | MSW intercepts at network level; no separate process; works in Vitest too |
| API response type safety | TypeScript interfaces with no runtime check | Zod schemas + `z.infer<>` | Runtime validation catches schema drift when real API differs from mock; TS interfaces are erased at runtime |
| HTTP request interceptors | Fetch wrapper with manual header injection | axios + interceptors | axios interceptors handle request config and error normalization in one place |
| Thousand-separator grouping for VND | Manual string manipulation | `Intl.NumberFormat('vi-VN')` | Gets locale-correct separators (dots for VN locale); edge cases with 7-digit amounts handled correctly |
| Timezone conversion | Manual UTC offset arithmetic (`+7 * 3600000`) | `@date-fns/tz` `TZDate` | DST-safe (Vietnam has no DST but using IANA name future-proofs it); handles edge cases like midnight UTC becoming previous day in UTC+7 |
| Conditional class strings | `className={loading ? 'class-a' : 'class-b' + ' ' + 'class-c'}` | `clsx` + `tailwind-merge` | Avoids Tailwind class conflicts and messy string concatenation |

**Key insight:** The combination of Zod (API boundary) + TanStack Query (caching) + MSW (dev mock) eliminates three entire categories of bugs: type drift, manual loading state, and conditional mock logic. None of these can be safely hand-rolled at the same quality level.

---

## Common Pitfalls

### Pitfall 1: Race Condition on MSW Worker Start

**What goes wrong:** App renders and fires TanStack Query requests before MSW service worker is registered. First data fetch hits the network (returns 404 or hangs), subsequent fetches work fine. Intermittent failures in dev that disappear on reload.

**Why it happens:** `worker.start()` returns a Promise. If you don't `await` it before calling `ReactDOM.createRoot().render()`, the app renders immediately while worker registration is still pending.

**How to avoid:** Wrap render in an `async` function and `await worker.start()` inside it (see Pattern 1 above). The `enableMocking()` function pattern is the official MSW recommendation.

**Warning signs:** Seeing real network errors in browser DevTools on first load that go away after refresh; `useQuery` shows `isError: true` briefly then switches to `isSuccess`.

### Pitfall 2: Zustand v5 Object Selector Infinite Loop

**What goes wrong:** Component re-renders infinitely. Every render triggers the Zustand selector, which returns a new object reference, which triggers a re-render.

**Why it happens:** Without `useShallow`, Zustand uses reference equality to determine if the store slice changed. An object selector `(state) => ({ a: state.a, b: state.b })` creates a new object on every call, so reference always differs.

**How to avoid:** Use `useShallow` from `zustand/react/shallow` for any selector that returns an object or array. For primitive selectors (`(state) => state.accountId`) no wrapping is needed.

**Warning signs:** React DevTools shows a component rendering hundreds of times per second; CPU spikes to 100% on page load.

### Pitfall 3: Zod v4 Import Breakage

**What goes wrong:** Code uses `z.string().email()`, `z.string().url()`, `z.string().uuid()` — these throw at runtime in Zod v4 because the string format validators were moved to top-level functions.

**Why it happens:** Zod v4 removed method-chained format validators (`z.string().email()`) in favour of top-level functions (`z.email()`). The TypeScript types may not catch this immediately if there is a version mismatch between installed zod and `@types`.

**How to avoid:** Use `z.email()`, `z.url()`, `z.uuid()` in Zod v4. Also: `error.errors` → `error.issues` in ZodError catch blocks.

**Warning signs:** `z.string().email is not a function` runtime error; `ZodError.errors` is `undefined` in catch blocks.

### Pitfall 4: VND Symbol Inconsistency Across OS

**What goes wrong:** `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` outputs `1.500.000 ₫` on macOS/Linux but `₫ 1.500.000` on some Windows versions, or uses narrow no-break space instead of regular space. The locked decision requires `đ 1.500.000` specifically.

**Why it happens:** ECMA-402 (`Intl`) delegates formatting to the host OS's ICU library, which varies by OS version and locale data. The symbol character (`₫` vs `đ`) and position (pre vs post) are not guaranteed.

**How to avoid:** Use `Intl.NumberFormat` only for the number part (group separators), then construct the final string manually: strip the currency symbol from the output and prepend `đ ` (see Pattern 6 `formatVND`). Test the function on both Windows and macOS/Linux during Phase 1.

**Warning signs:** `formatVND(1500000)` returns `₫1.500.000` or `1.500.000 ₫` instead of `đ 1.500.000`.

### Pitfall 5: TanStack Query v5 `onSuccess`/`onError` Removed

**What goes wrong:** Code copied from v4 examples uses `onSuccess`/`onError` callbacks in `useQuery`. TypeScript will show an error (`Object literal may only specify known properties`). If the error is suppressed, the callbacks silently do nothing.

**Why it happens:** TanStack Query v5 intentionally removed these callbacks from `useQuery` and `QueryObserver` because their behaviour was confusing (called once per observer, not once per successful fetch).

**How to avoid:** Use `useEffect` to react to query state changes:

```typescript
const { data, isError, error } = useQuery({ ... })

useEffect(() => {
  if (isError) toast.error(error.message)
}, [isError, error])
```

Or use `queryClient.setMutationDefaults` for mutation callbacks.

**Warning signs:** TypeScript error `'onSuccess' does not exist in type 'UndefinedInitialDataOptions'`.

### Pitfall 6: MSW Query Params in URL Pattern

**What goes wrong:** MSW handler defined as `http.get('/api/transactions?limit=20', handler)` does not intercept real requests with different query param values. MSW logs a warning and requests fall through to the network.

**Why it happens:** MSW treats query params as part of request metadata, not the resource path. The path pattern should identify the resource, not filter parameters.

**How to avoid:** Define handlers with only the path, then read query params from `new URL(request.url).searchParams` inside the handler function body.

**Warning signs:** Requests appear in Network tab as real network calls (not struck-through or marked as mocked); MSW console logs `[MSW] Warning: captured a request without a matching request handler`.

### Pitfall 7: date-fns-tz vs @date-fns/tz Confusion

**What goes wrong:** Code installs `date-fns-tz` (the old third-party library) instead of `@date-fns/tz` (the official date-fns v4 companion). Both may exist in npm but their APIs differ significantly. `date-fns-tz` uses `zonedTimeToUtc`/`utcToZonedTime`; `@date-fns/tz` uses `TZDate` class.

**Why it happens:** Search results and blog posts written before September 2024 (date-fns v4 release) reference `date-fns-tz`. Package names are similar enough to cause confusion.

**How to avoid:** Install `@date-fns/tz` (with the `@date-fns/` scope prefix). Check `package.json` — `date-fns-tz` without scope is the old library. The `@date-fns/tz` package provides `TZDate` class compatible with all date-fns v4 functions.

**Warning signs:** Import `import { utcToZonedTime } from 'date-fns-tz'` — this is the wrong package for date-fns v4.

---

## Code Examples

Verified patterns from official sources:

### apiClient.ts — Axios Instance

```typescript
// src/services/apiClient.ts
// Source: axios official docs — https://axios-http.com/docs/interceptors
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',              // MSW intercepts relative /api/* paths
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: inject auth header (placeholder for real API)
apiClient.interceptors.request.use((config) => {
  // Phase 1: no real auth needed (MSW)
  // Phase 5: inject Bearer token here
  return config
})

// Response interceptor: normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalize to ApiError shape matching locked contract
    const apiError = {
      code: error.response?.status?.toString() ?? 'NETWORK_ERROR',
      message: error.response?.data?.message ?? error.message,
      details: error.response?.data?.details,
    }
    return Promise.reject(apiError)
  }
)
```

### Typed Mock Fixtures

```typescript
// src/mocks/fixtures/accounts.ts
// Source: locked decision — 2 bank accounts, Vietnamese banking domain
import type { BankAccount } from '../../types/account'

export const mockAccounts: BankAccount[] = [
  {
    id: 'vcb-checking-001',
    bankName: 'Vietcombank',
    accountName: 'Tài khoản thanh toán',
    accountNumber: '****1234',
    accountType: 'checking',
    currency: 'VND',
    balance: 15_750_000,       // Integer VND
    lastUpdated: '2026-02-28T08:00:00Z',
  },
  {
    id: 'tcb-saving-001',
    bankName: 'Techcombank',
    accountName: 'Tài khoản tiết kiệm',
    accountNumber: '****5678',
    accountType: 'savings',
    currency: 'VND',
    balance: 42_000_000,
    lastUpdated: '2026-02-28T08:00:00Z',
  },
]
```

### TanStack Query v5 useInfiniteQuery for Cursor Pagination

```typescript
// Feature hook for paginated transactions
// Source: TanStack Query v5 docs — https://tanstack.com/query/v5/docs/react/guides/infinite-queries
import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactions } from '../services/accounts'

export function useTransactionsList(accountId: string) {
  return useInfiniteQuery({
    queryKey: ['transactions', accountId],
    queryFn: ({ pageParam }) =>
      getTransactions(accountId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accountId),
  })
}
```

### BankAccount Zod Schema (Complete Phase 1 Domain)

```typescript
// src/types/account.ts — complete schema set for Phase 1
import { z } from 'zod'

export const BankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountName: z.string(),
  accountNumber: z.string(),  // masked, e.g. "****1234"
  accountType: z.enum(['checking', 'savings']),
  currency: z.literal('VND'),
  balance: z.number().int(),
  lastUpdated: z.string().datetime(),
})

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number().int(),          // Positive = income, negative = expense
  description: z.string(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),
  postedDate: z.string().datetime().optional(),
})

export const CreditCardSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  cardName: z.string(),
  cardNumber: z.string(),   // masked
  cardType: z.enum(['visa', 'mastercard', 'jcb']),
  currency: z.literal('VND'),
  creditLimit: z.number().int(),
  currentBalance: z.number().int(),
  statementDate: z.number().int().min(1).max(31),   // day of month
  paymentDueDate: z.number().int().min(1).max(31),  // day of month
  lastUpdated: z.string().datetime(),
})

export const CreditCardTransactionSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  amount: z.number().int(),
  description: z.string(),
  merchantName: z.string(),
  category: z.string().optional(),
  type: z.enum(['purchase', 'payment', 'refund', 'fee']),
  status: z.enum(['pending', 'posted']),
  transactionDate: z.string().datetime(),
  postedDate: z.string().datetime().optional(),
  billingCycleStart: z.string().datetime().optional(),
  billingCycleEnd: z.string().datetime().optional(),
})

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number().int(),
  })

// Derived types
export type BankAccount = z.infer<typeof BankAccountSchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type CreditCard = z.infer<typeof CreditCardSchema>
export type CreditCardTransaction = z.infer<typeof CreditCardTransactionSchema>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date-fns-tz` (third-party) | `@date-fns/tz` (official) | date-fns v4.0, Sep 2024 | Install `@date-fns/tz`, NOT `date-fns-tz`; API uses `TZDate` class |
| Zustand `create<T>()` (v4) | `create<T>()()` double curry (v5) | Zustand v5.0, Oct 2024 | TypeScript requires double curry; single curry still works in JS but fails TS strict mode |
| TanStack Query `cacheTime` | `gcTime` (v5) | TanStack Query v5, Oct 2023 | `cacheTime` no longer exists; TypeScript will error |
| TanStack Query `keepPreviousData` | `placeholderData: keepPreviousData` (v5) | TanStack Query v5, Oct 2023 | Import `keepPreviousData` from `@tanstack/react-query` |
| Zod `z.string().email()` | `z.email()` (v4) | Zod v4, Aug 2025 | String format validators moved to top-level; old API removed |
| Zod `ZodError.errors` | `ZodError.issues` (v4) | Zod v4, Aug 2025 | `errors` property removed from ZodError; use `issues` |
| Tailwind CSS v3 in shadcn | Tailwind CSS v4 (now default) | shadcn Feb 2025 | New projects auto-scaffold with v4; v3 available via legacy docs |
| `tailwindcss-animate` | `tw-animate-css` | shadcn + Tailwind v4 | New shadcn projects use `tw-animate-css` for animations |
| MSW `rest.get(...)` | `http.get(...)` (v2) | MSW v2.0, Oct 2023 | `rest` namespace removed; use `http` from `msw` |
| MSW v1 `ctx.json(data)` | `HttpResponse.json(data)` (v2) | MSW v2.0, Oct 2023 | `ctx` API removed entirely in v2 |

**Deprecated/outdated (do not use):**
- `date-fns-tz` (without scope): Old third-party library; incompatible with date-fns v4
- `react-query` (package name): Superseded by `@tanstack/react-query`
- `zustand/middleware/devtools` import: In v5, use `import { devtools } from 'zustand/middleware'` directly
- CRA (`create-react-app`): Deprecated and unmaintained since 2023; use Vite

---

## Open Questions

1. **VND Format: `đ` Symbol Verification**
   - What we know: `Intl.NumberFormat('vi-VN')` uses `₫` (U+20AB); locked decision requires `đ` (U+00D1). The `formatVND` wrapper normalises this.
   - What's unclear: Whether the normalisation regex handles all OS variants (Windows Server, older Node ICU builds).
   - Recommendation: Add a unit test for `formatVND(1_500_000)` that asserts exactly `"đ 1.500.000"` and run it on CI as part of Phase 1 deliverables.

2. **Zod v4 or v3 — Which Is Installed?**
   - What we know: `npm install zod` will install v4 as of August 2025. v4 has breaking changes vs v3.
   - What's unclear: If any transitive dependency pins `zod@^3`, there may be a version conflict.
   - Recommendation: Run `npm ls zod` after install and verify the top-level version is v4. Use `zod/v3` subpath import only as a migration fallback, not for new code.

3. **Tailwind v4 + shadcn: `tw-animate-css` vs `tailwindcss-animate`**
   - What we know: New shadcn projects default to Tailwind v4 and `tw-animate-css`; old projects use `tailwindcss-animate`.
   - What's unclear: Whether `npx shadcn@latest add` for individual components triggers the correct animation package when running in a v4 project.
   - Recommendation: Follow the `npx shadcn@latest init` wizard output exactly; do not manually install `tailwindcss-animate` in a v4 project.

---

## Sources

### Primary (HIGH confidence)

- [MSW Browser Integration docs](https://mswjs.io/docs/integrations/browser/) — complete browser setup pattern, `worker.start()` Promise behaviour
- [shadcn Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 is now default; v3 still supported; `tw-animate-css` replaces `tailwindcss-animate`
- [shadcn CLI docs](https://ui.shadcn.com/docs/cli) — `npx shadcn@latest init` command
- [date-fns v4 timezone blog](https://blog.date-fns.org/v40-with-time-zone-support/) — `@date-fns/tz` replaces `date-fns-tz`; `TZDate` class API
- [TanStack Query v5 announcement](https://tanstack.com/blog/announcing-tanstack-query-v5) — `onSuccess`/`onError` removal, `cacheTime` → `gcTime`, single object param API
- [Zustand v5 announcement](https://pmnd.rs/blog/announcing-zustand-v5) — v5.0.11 stable; `create<T>()()` pattern; `useShallow` required for objects
- [Zod v4 release / InfoQ](https://www.infoq.com/news/2025/08/zod-v4-available/) — v4 stable Aug 2025; string format validators moved to top-level
- [Vite 6 release](https://vite.dev/blog/announcing-vite6) — Node 18/20/22 support; Environment API
- MDN `Intl.NumberFormat` — vi-VN locale behaviour for VND currency

### Secondary (MEDIUM confidence)

- [TanStack Query v5 TypeScript docs](https://tanstack.com/query/v5/docs/framework/react/typescript) — TypeScript inference patterns
- [TanStack Query v5 infinite queries docs](https://tanstack.com/query/v5/docs/react/guides/infinite-queries) — cursor pagination with `useInfiniteQuery`
- [Zustand migration guide](https://github.com/pmndrs/zustand/blob/main/docs/migrations/migrating-to-v5.md) — v4 → v5 breaking changes
- [Zod v4 migration gist](https://gist.github.com/imaman/a62d1c7bab770a3b49fe3be10a66f48a) — breaking change catalogue
- [MSW structuring handlers best practices](https://mswjs.io/docs/best-practices/structuring-handlers/) — query param pattern

### Tertiary (LOW confidence)

- [VND Intl.NumberFormat community examples](https://copyprogramming.com/howto/vnd-currency-formatting) — symbol position behaviour; verify with unit test
- Vite path aliases with `vite-tsconfig-paths` — recommended by community; verify against Vite 6 docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official announcements and docs (Zustand v5, Zod v4, date-fns v4, shadcn/Tailwind v4, MSW v2, TanStack Query v5)
- Architecture: HIGH — patterns derived from official docs and locked CONTEXT.md decisions
- Pitfalls: HIGH — all pitfall claims are verified against official migration guides or spec-level facts (IEEE 754, ECMA-402)
- VND formatting: MEDIUM — `Intl.NumberFormat` behaviour documented in ECMA-402 but OS variance requires runtime verification

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (30 days — stable libraries; watch for shadcn/Tailwind v4 rapid iteration)
