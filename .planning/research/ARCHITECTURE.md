# Architecture Research

**Domain:** Frontend-only personal finance dashboard (React + TypeScript)
**Researched:** 2026-03-02
**Confidence:** MEDIUM — Training knowledge (cutoff Aug 2025). WebSearch and WebFetch unavailable during research session. Patterns drawn from established React ecosystem conventions; verify against current TanStack Query and Zustand docs before implementation.

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                        │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│  Dashboard   │  Transaction │  Credit Card │  Account         │
│  Page        │  List Page   │  Page        │  Summary Page    │
│  (charts,    │  (filter,    │  (billing    │  (balances,      │
│   totals)    │   search,    │   cycles,    │   accounts)      │
│              │   paginate)  │   statements)│                  │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────────┘
       │              │              │              │
┌──────┴──────────────┴──────────────┴──────────────┴───────────┐
│                   Feature Hooks Layer                           │
│   useTransactions()  useAccounts()  useCreditCards()          │
│   useBillingCycles()  useDashboardSummary()                   │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────┴────────────────────────────────┐
│              State Management Layer (Zustand)                   │
│   accountsStore    transactionsStore    uiStore (filters,      │
│                                         date range, search)    │
└──────────────────────────────┬────────────────────────────────┘
                               │
┌──────────────────────────────┴────────────────────────────────┐
│               API Service Layer                                 │
│   apiClient (axios/fetch + base config)                        │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ accountsApi  │  │transactions  │  │ creditCard   │        │
│   │              │  │ Api          │  │ Api          │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│   [dev]  mockApiAdapter ──────────────────────────────────     │
│   [prod] realApiAdapter ──────────────────────────────────     │
└─────────────────────────────────────────────────────────────── ┘
                               │
┌──────────────────────────────┴────────────────────────────────┐
│              Third-Party Banking API                            │
│   GET /accounts   GET /transactions   GET /credit-cards        │
│   (external — may require CORS proxy or token-based auth)      │
└───────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Page components | Route-level containers, compose feature components | React Router pages under `src/pages/` |
| Feature components | Domain-specific UI (TransactionList, BillingCycleCard) | Under `src/components/[feature]/` |
| Feature hooks | Business logic, data fetching, derived state | `src/hooks/use[Feature].ts` wrapping TanStack Query |
| Zustand stores | Client-side state (filters, UI state, cached data) | `src/store/[domain]Store.ts` |
| API service modules | API call functions grouped by domain | `src/services/[domain]Api.ts` |
| API client | Shared axios/fetch instance with base URL, headers, interceptors | `src/services/apiClient.ts` |
| Mock adapter | Intercepts API calls in dev, returns fixture data | `src/services/mockApi/` or MSW handlers |
| Type definitions | Shared TypeScript interfaces for all domain models | `src/types/` |

## Recommended Project Structure

```
src/
├── pages/                    # Route-level components (one per route)
│   ├── DashboardPage.tsx     # Overview: totals, charts, account summary
│   ├── TransactionsPage.tsx  # Full transaction list with filter/search
│   ├── CreditCardPage.tsx    # Credit card billing cycles + statements
│   └── AccountsPage.tsx      # Bank account list and balances
│
├── components/               # Reusable UI components
│   ├── dashboard/
│   │   ├── BalanceSummary.tsx
│   │   ├── SpendingChart.tsx
│   │   └── RecentTransactions.tsx
│   ├── transactions/
│   │   ├── TransactionList.tsx
│   │   ├── TransactionItem.tsx
│   │   ├── TransactionFilters.tsx
│   │   └── TransactionSearch.tsx
│   ├── credit-card/
│   │   ├── BillingCycleCard.tsx      # Shows current cycle + due date
│   │   ├── StatementList.tsx
│   │   └── CreditCardSummary.tsx
│   └── shared/
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       ├── EmptyState.tsx
│       └── Pagination.tsx
│
├── hooks/                    # Feature hooks (data fetching + business logic)
│   ├── useTransactions.ts    # Fetch + filter + paginate transactions
│   ├── useAccounts.ts        # Fetch bank account list + balances
│   ├── useCreditCards.ts     # Fetch credit card info
│   ├── useBillingCycles.ts   # Compute/fetch billing cycle data
│   └── useDashboard.ts       # Aggregate: totals, recent activity
│
├── store/                    # Zustand global state
│   ├── transactionStore.ts   # Filter state, pagination, search query
│   ├── accountStore.ts       # Selected account, cached account list
│   └── uiStore.ts            # Date range selection, active tab, loading
│
├── services/                 # API service layer
│   ├── apiClient.ts          # Base fetch/axios instance, headers, interceptors
│   ├── accountsApi.ts        # getAccounts(), getAccountById()
│   ├── transactionsApi.ts    # getTransactions(filters), getTransaction(id)
│   ├── creditCardApi.ts      # getCreditCards(), getBillingCycles()
│   └── mock/                 # Mock API adapter (dev only)
│       ├── handlers.ts       # MSW request handlers or manual stubs
│       ├── fixtures/
│       │   ├── accounts.json
│       │   ├── transactions.json
│       │   └── creditCards.json
│       └── index.ts          # Setup worker / toggle switch
│
├── types/                    # TypeScript domain models
│   ├── account.ts            # BankAccount, AccountBalance
│   ├── transaction.ts        # Transaction, TransactionType, TransactionFilter
│   ├── creditCard.ts         # CreditCard, BillingCycle, Statement
│   └── api.ts                # ApiResponse<T>, PaginatedResponse<T>, ApiError
│
├── utils/                    # Pure utility functions
│   ├── formatCurrency.ts     # VND / multi-currency formatting
│   ├── formatDate.ts         # Date display, billing cycle date math
│   └── groupTransactions.ts  # Group by day, cycle, category
│
├── App.tsx                   # Router setup, providers
└── main.tsx                  # Vite entry, MSW startup in dev
```

### Structure Rationale

- **pages/:** One file per route. Keep them thin — they compose components, provide data via hooks, pass no raw API data down.
- **components/[feature]/:** Co-locate all UI for a domain. `TransactionList` should not know about `BillingCycle`.
- **hooks/:** The only place that touches `services/` and `store/` together. Pages import hooks, not services directly.
- **services/:** Pure functions — no React, no state. Each file maps to one API resource domain. Swap mock/real via `apiClient.ts` config.
- **store/:** Only UI-driven state (filters, search, pagination cursor). Server data lives in TanStack Query cache, not Zustand.
- **types/:** Single source of truth. Import everywhere. Never redefine inline.
- **mock/:** MSW handlers in `src/services/mock/` — activated in `main.tsx` via `import.meta.env.MODE === 'development'` guard.

## Architectural Patterns

### Pattern 1: API Service Abstraction with Environment-Switched Adapter

**What:** The API client (`apiClient.ts`) exports a configured instance. Service modules (`transactionsApi.ts`, etc.) call only through this client. In development, an MSW worker intercepts all network requests and returns fixtures. In production, real requests go through.

**When to use:** Always — this is the foundation for testable, swappable API layers.

**Trade-offs:** MSW requires a service worker file in `public/`. Small setup cost. Worth it — no conditional logic scattered in components.

**Example:**
```typescript
// src/services/apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// Interceptor: normalize error shape
apiClient.interceptors.response.use(
  (res) => res,
  (error) => Promise.reject({
    message: error.response?.data?.message ?? 'Unknown error',
    status: error.response?.status,
  })
);
```

```typescript
// src/services/transactionsApi.ts
import { apiClient } from './apiClient';
import type { Transaction, TransactionFilter, PaginatedResponse } from '../types';

export async function getTransactions(
  filters: TransactionFilter
): Promise<PaginatedResponse<Transaction>> {
  const { data } = await apiClient.get('/transactions', { params: filters });
  return data;
}
```

```typescript
// src/main.tsx — MSW startup guard
async function bootstrap() {
  if (import.meta.env.MODE === 'development') {
    const { worker } = await import('./services/mock');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}
bootstrap();
```

### Pattern 2: Feature Hook — Single Data Contract Between Service and UI

**What:** Custom hooks are the only coupling point between the API service layer and the UI. A page component calls `useTransactions(filters)` and receives `{ data, isLoading, isError, error }`. It never calls `transactionsApi.getTransactions()` directly.

**When to use:** Always. This keeps components ignorant of fetching mechanics, caching strategy, or API shape transformations.

**Trade-offs:** Adds an indirection layer. Worth it — you can change the backend, caching library, or data shape without touching a single component.

**Example:**
```typescript
// src/hooks/useTransactions.ts
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../services/transactionsApi';
import { useTransactionStore } from '../store/transactionStore';
import type { Transaction } from '../types';

export function useTransactions() {
  const filters = useTransactionStore((s) => s.filters);

  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes — transactions don't change often
    placeholderData: (prev) => prev, // keep old data while refetching on filter change
  });
}
```

### Pattern 3: Zustand for UI State Only — Server State in TanStack Query

**What:** Zustand owns filter values, pagination cursors, search strings, selected account IDs, and date range pickers. TanStack Query owns API response data and its caching/invalidation lifecycle. Never put API response arrays into Zustand.

**When to use:** Whenever both filter UI state and server data coexist in a feature (e.g., TransactionList with filter sidebar).

**Trade-offs:** Two state systems to learn. The boundary is clear: "Did this come from the server? → TanStack Query. Did the user select/type this? → Zustand."

**Example:**
```typescript
// src/store/transactionStore.ts
import { create } from 'zustand';
import type { TransactionFilter } from '../types';

interface TransactionStoreState {
  filters: TransactionFilter;
  setFilter: (key: keyof TransactionFilter, value: unknown) => void;
  resetFilters: () => void;
}

const defaultFilters: TransactionFilter = {
  accountId: undefined,
  type: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  search: '',
  page: 1,
  limit: 20,
};

export const useTransactionStore = create<TransactionStoreState>((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value, page: 1 } })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
```

### Pattern 4: Billing Cycle Date Math as Pure Utils

**What:** Credit card billing cycle display requires date arithmetic (cycle start/end, days remaining, statement date). Keep this in pure utility functions in `src/utils/formatDate.ts`, not inside components or hooks.

**When to use:** Any time you need to derive billing period from raw dates.

**Trade-offs:** None — pure functions are easy to test and reuse.

**Example:**
```typescript
// src/utils/formatDate.ts
export function getCurrentBillingCycle(statementDay: number): {
  cycleStart: Date;
  cycleEnd: Date;
  daysRemaining: number;
} {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let cycleEnd = new Date(currentYear, currentMonth, statementDay);
  if (today > cycleEnd) {
    cycleEnd = new Date(currentYear, currentMonth + 1, statementDay);
  }
  const cycleStart = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, statementDay + 1);
  const daysRemaining = Math.ceil((cycleEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return { cycleStart, cycleEnd, daysRemaining };
}
```

## Data Flow

### Request Flow — Transaction List with Filters

```
User changes filter (date range, account)
    ↓
TransactionFilters component calls store action: setFilter('dateFrom', value)
    ↓
useTransactionStore updates filters object
    ↓
useTransactions() hook re-runs (queryKey changes: ['transactions', newFilters])
    ↓
TanStack Query checks cache → cache miss → calls getTransactions(filters)
    ↓
getTransactions() → apiClient.get('/transactions', { params: filters })
    ↓
[dev] MSW intercepts → returns fixture JSON
[prod] Real API responds with PaginatedResponse<Transaction>
    ↓
TanStack Query caches result, sets data in query cache
    ↓
useTransactions() returns { data: PaginatedResponse<Transaction>, isLoading: false }
    ↓
TransactionList renders TransactionItem[] from data.items
```

### Request Flow — Dashboard Summary

```
DashboardPage mounts
    ↓
useDashboard() hook fires parallel queries:
  - useQuery(['accounts']) → getAccounts()
  - useQuery(['transactions', { limit: 5 }]) → getTransactions()
  - useQuery(['credit-cards']) → getCreditCards()
    ↓
All three resolve → hook computes derived values:
  totalBalance = sum(accounts.map(a => a.balance))
  totalIncome = sum(transactions.filter(t => t.type === 'credit').map(t => t.amount))
  totalExpenses = sum(transactions.filter(t => t.type === 'debit').map(t => t.amount))
    ↓
DashboardPage receives { totalBalance, totalIncome, totalExpenses, recentTransactions }
    ↓
BalanceSummary, SpendingChart, RecentTransactions render independently
```

### State Management Flow

```
[Zustand: UI State]             [TanStack Query: Server State]
  filters.dateFrom    ───────►  queryKey: ['transactions', filters]
  filters.accountId   ───────►       ↓
  filters.search      ───────►  fetch → cache → data
  pagination.page     ───────►       ↓
                                components read data
                                (never stored in Zustand)
```

### Mock/Real API Switch Flow

```
main.tsx on startup:
  if (MODE === 'development')
    → import MSW worker
    → worker.start()      ← intercepts all fetch/XHR in browser
    → ReactDOM.createRoot(...)

apiClient.get('/transactions')
  → browser fetch('/transactions')
  [dev]  MSW handler matches → returns fixtures/transactions.json
  [prod] Actual network request → third-party banking API
```

## Scaling Considerations

This is a personal-use, single-user frontend app. Scaling here means "handles growing data volumes gracefully", not multi-tenancy.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| < 500 transactions | No pagination needed; fetch all and filter client-side |
| 500–5,000 transactions | Server-side pagination required (already in filter params); virtual scrolling for the list |
| 5,000+ transactions | Infinite scroll or cursor-based pagination; consider pre-fetching next page |

### Scaling Priorities

1. **First bottleneck:** Large transaction lists will cause slow renders. Use virtualization (`@tanstack/react-virtual`) before adding more features. Add when item count exceeds ~200 visible rows.
2. **Second bottleneck:** Dashboard charts recomputing on every render. Memoize aggregations with `useMemo`. Only recalculate when query data changes.

## Anti-Patterns

### Anti-Pattern 1: Fetching API Data Directly Inside Components

**What people do:** Call `fetch('/api/transactions')` or `transactionsApi.getTransactions()` directly inside a `useEffect` in a page or list component.

**Why it's wrong:** No caching, no deduplication, no loading/error state standardization, waterfall requests, race conditions on fast filter changes.

**Do this instead:** All fetching goes through TanStack Query hooks in `src/hooks/`. Components only receive `{ data, isLoading, isError }`.

### Anti-Pattern 2: Storing Server Data in Zustand

**What people do:** `accountStore.setAccounts(apiResponse.data)` — push API responses into Zustand.

**Why it's wrong:** Duplicates state, creates staleness bugs (Zustand data out of sync with server), defeats TanStack Query's caching.

**Do this instead:** TanStack Query is the cache for server data. Zustand holds only UI-driven state (what the user has selected, typed, or toggled).

### Anti-Pattern 3: Conditional API URLs to Switch Mock/Real

**What people do:** `const url = isDev ? '/mock/transactions' : 'https://api.bank.com/transactions'` scattered in service files.

**Why it's wrong:** Conditional logic spreads across many files, mock diverges from real API shape silently, hard to maintain.

**Do this instead:** One MSW setup in `main.tsx`. All service files call the same URL always. MSW intercepts in dev without any code change in services.

### Anti-Pattern 4: Putting Billing Cycle Logic in JSX

**What people do:** Computing cycle start/end dates inline inside `BillingCycleCard.tsx` render function.

**Why it's wrong:** Untestable, duplicated if used in multiple places, inflates component complexity.

**Do this instead:** Pure utility functions in `src/utils/formatDate.ts`. Import into the component. Easy to unit test in isolation.

### Anti-Pattern 5: One Giant Transaction Store with Everything

**What people do:** Single Zustand store with `filters`, `transactions`, `accounts`, `creditCards`, `selectedAccount`, `billingCycles`, `isLoading`, `error` all merged together.

**Why it's wrong:** Unrelated state changes trigger re-renders in unrelated components. Becomes unmaintainable quickly.

**Do this instead:** Separate stores by domain: `transactionStore` (filters only), `accountStore` (selected account), `uiStore` (global UI: date range, active tab). Each store is small and focused.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Third-party banking API | REST calls via `apiClient.ts` (axios instance) | Likely needs CORS handling; if API doesn't allow browser direct calls, a lightweight proxy (Vercel Edge Function or Cloudflare Worker) may be required — do not add a full backend |
| MSW (Mock Service Worker) | Service worker in `public/mockServiceWorker.js`, handlers in `src/services/mock/handlers.ts` | Run `npx msw init public/` once during project setup |
| Chart library (Recharts / Chart.js) | Import components directly; feed computed totals as props | No API integration needed — charts consume already-fetched data |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pages ↔ Hooks | Hooks called inside pages; pages receive typed return values | Pages must not import from `services/` directly |
| Hooks ↔ Store | Hooks read from Zustand store for filter params | Hooks write to store only for derived UI state (e.g., total page count) |
| Hooks ↔ Services | Hooks call service functions inside `queryFn` | One-directional: hooks call services, never the reverse |
| Services ↔ API Client | Service functions call `apiClient.get/post` only | No raw `fetch()` or `axios` imports outside `apiClient.ts` |
| Components ↔ Store | Feature components may read store directly for controlled inputs | Avoid prop-drilling filter state through 3+ levels; use store instead |

## Suggested Build Order

Build in this sequence to avoid blockers:

1. **Types first** (`src/types/`) — All domain models defined before any code that uses them. Unblocks everything.
2. **Mock fixtures + MSW handlers** (`src/services/mock/`) — Enables UI development without the real API. Unblocks all UI work.
3. **API client + service modules** (`src/services/apiClient.ts`, `*Api.ts`) — Thin wrappers; mock handles responses in dev.
4. **Zustand stores** (`src/store/`) — Filter and UI state shapes defined before hooks need them.
5. **Feature hooks** (`src/hooks/`) — Connect stores to TanStack Query. This is where business logic lives.
6. **Shared components** (`src/components/shared/`) — LoadingSpinner, ErrorBoundary, EmptyState needed everywhere.
7. **Feature components** (`src/components/[feature]/`) — Build per domain: Transactions, then CreditCard, then Dashboard.
8. **Pages** (`src/pages/`) — Compose feature components. Thin wrappers that provide routing context.
9. **Real API wiring** — Replace mock fixtures with real API base URL. Validate response shapes match TypeScript types.

## Sources

- Pattern knowledge: React ecosystem conventions, TanStack Query official documentation patterns (training data, cutoff Aug 2025) — MEDIUM confidence
- MSW architecture: Mock Service Worker documentation patterns (training data) — MEDIUM confidence
- Zustand + TanStack Query separation: Established community pattern documented across multiple React architecture guides (training data) — MEDIUM confidence
- Billing cycle date math: Standard JavaScript Date API patterns — HIGH confidence (deterministic)
- CORS consideration for banking APIs: Documented constraint in financial API integrations — MEDIUM confidence

**Note:** Web search and WebFetch were unavailable during this research session. All patterns are based on training data (cutoff Aug 2025). Verify current TanStack Query v5 API, Zustand v5 API, and MSW v2 API against official docs before implementation. Core architectural patterns are stable and unlikely to have changed materially.

---
*Architecture research for: Frontend-only personal finance dashboard*
*Researched: 2026-03-02*
