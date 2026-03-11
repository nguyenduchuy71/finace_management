# SKILLS.md — Vibe Finance Management

Quick reference for AI-assisted programming sessions. Read this before modifying code.

---

## Project Identity

- **Stack:** Vite 7 + React 19 (StrictMode) + TypeScript 5.9.3
- **Styling:** Tailwind CSS v4 (CSS-first) + shadcn/ui (New York style)
- **Data:** TanStack Query v5 + Zustand v5
- **Mocking:** MSW v2.12
- **Testing:** Vitest v4 + React Testing Library
- **Routing:** React Router DOM v7
- **Validation:** Zod v4 at all API boundaries
- **HTTP:** Axios with response interceptor → normalized `ApiError`
- **AI:** Anthropic SDK v0.78.0 (chatbot feature)
- **Charts:** Recharts v3 (lazy-loaded)

---

## Critical Patterns — Never Break These

### 1. MSW Deferred Render Guard
`src/main.tsx` — ReactDOM.createRoot must not be called before MSW is ready.
```ts
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(...)
})
```

### 2. Zustand v5 Double-Curry
```ts
const useStore = create<State>()((set) => ({ ... }))
```
Always use `useShallow` when selecting multiple fields:
```ts
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })))
```

### 3. Filter Params in QueryKey
All filter state must be included in the queryKey so TanStack Query auto-refetches:
```ts
queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, category }]
```

### 4. Zod Validation at Service Boundary
```ts
export async function getAccounts() {
  const res = await apiClient.get('/accounts')
  return AccountsResponseSchema.parse(res.data) // Always parse here
}
```

### 5. Lazy-Load Heavy Chunks
```ts
const CategoryChart = lazy(() =>
  import('@/features/dashboard/CategoryChart').then((m) => ({ default: m.CategoryChart }))
)
// Wrap in <Suspense fallback={<CategoryChartSkeleton />}>
```

---

## Directory Map

```
src/
├── main.tsx                      # Entry — MSW guard + ReactDOM
├── App.tsx                       # QueryClient config + BrowserRouter + routes
├── index.css                     # Tailwind v4 + shadcn CSS vars + custom utilities
│
├── pages/
│   ├── DashboardPage.tsx
│   ├── BankAccountsPage.tsx
│   └── CreditCardsPage.tsx
│
├── features/
│   ├── accounts/AccountTabs.tsx
│   ├── transactions/             # TransactionList, TransactionRow, Skeleton, EmptyState
│   ├── creditCards/              # CreditCardTabs, BillingCycleGroup, CreditCardTransactionList
│   ├── dashboard/                # StatCard, CategoryChart, DashboardDatePicker, BudgetProgressSection
│   └── chatbot/                  # ChatPanel, ChatMessage, ChatInput, useChatApi
│
├── components/
│   ├── layout/AppShell.tsx       # Main wrapper with <Outlet>
│   ├── layout/AppHeader.tsx      # Nav + theme toggle
│   ├── filters/                  # FilterBar, SearchInput, DateRangePicker, CategoryFilter, ExportButton
│   ├── budget/                   # BudgetProgressBar, BudgetSettings
│   └── ui/                       # shadcn components (see list below)
│
├── hooks/
│   ├── useAccounts.ts            # Query: GET /api/accounts
│   ├── useTransactions.ts        # InfiniteQuery: bank transactions
│   ├── useCreditCards.ts         # Query: GET /api/credit-cards
│   ├── useCreditCardTransactions.ts
│   ├── useDashboardStats.ts      # useQueries: current + prev month
│   ├── useBudgetAlerts.ts
│   └── useDebounced.ts
│
├── services/
│   ├── apiClient.ts              # Axios instance, base=/api, timeout=10s
│   ├── accounts.ts               # getAccounts, getTransactions
│   ├── creditCards.ts            # getCreditCards, getCreditCardTransactions
│   ├── dashboard.ts              # getDashboardStats
│   └── exports.ts                # exportTransactions (full dataset for CSV)
│
├── stores/
│   ├── filterStore.ts            # accountId, cardId, dateFrom, dateTo, searchQuery, txType, category
│   ├── budgetStore.ts            # localStorage: finance-budgets
│   ├── chatStore.ts              # messages[], isOpen, apiConfig — localStorage: finance-chat-*
│   ├── dashboardStore.ts         # Dashboard-specific date range
│   ├── categoryOverrideStore.ts  # Per-transaction category overrides
│   └── themeStore.ts             # 'light'|'dark' — localStorage: finance-theme
│
├── types/
│   ├── account.ts                # BankAccount, Transaction (Zod schemas + inferred types)
│   ├── creditCard.ts             # CreditCard, CreditCardTransaction
│   ├── api.ts                    # ApiError, PaginatedResponse
│   ├── budget.ts                 # BudgetState
│   └── categories.ts             # Category union type (Vietnamese)
│
├── utils/
│   ├── currency.ts               # formatVND, formatVNDSigned, parseVND
│   ├── categories.ts             # classifyTransaction, CATEGORY_TAXONOMY
│   ├── dates.ts                  # Date range helpers
│   ├── billingCycle.ts           # Credit card billing cycle logic
│   └── csv.ts                    # CSV serialization
│
├── mocks/
│   ├── browser.ts                # setupWorker(handlers)
│   ├── server.ts                 # Node MSW server (tests)
│   ├── handlers.ts               # 5 handlers: accounts, transactions, credit-cards, CC-txns, dashboard
│   └── fixtures/
│       ├── accounts.ts           # VCB đ15.75M, TCB đ42M
│       ├── transactions.ts       # 70 bank transactions
│       └── creditCards.ts        # TCB Visa + VPBank Mastercard, 59 CC transactions
│
└── lib/utils.ts                  # cn() — clsx + twMerge
```

---

## Available shadcn Components (`src/components/ui/`)

| Component | Usage |
|-----------|-------|
| `badge.tsx` | Status/category labels |
| `button.tsx` | Variants: default, ghost, outline, destructive |
| `calendar.tsx` | react-day-picker based |
| `card.tsx` | Card, CardHeader, CardContent, CardFooter |
| `dialog.tsx` | Modal dialogs |
| `input.tsx` | Text inputs |
| `popover.tsx` | Popover wrapper |
| `select.tsx` | Dropdown select |
| `skeleton.tsx` | Loading placeholders |
| `sonner.tsx` | Toast notifications |
| `tabs.tsx` | Tab switcher |
| `CategoryBadge.tsx` | Custom — Category string → colored badge |

---

## API Endpoints (MSW Handles All)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/accounts` | Returns all bank accounts |
| GET | `/api/accounts/:id/transactions` | Cursor pagination + filters |
| GET | `/api/credit-cards` | Returns all credit cards |
| GET | `/api/credit-cards/:id/transactions` | Cursor pagination + filters |
| GET | `/api/dashboard/stats` | Aggregated stats, accepts dateFrom/dateTo |

**Pagination:** cursor-based using transaction ID (not offset).
**Filters:** `search`, `dateFrom`, `dateTo`, `txType` (income/expense/all), `category`

---

## Currency & Categories

```ts
// Currency
formatVND(1500000)       // "đ 1.500.000"
formatVNDSigned(-500000) // "- đ 500.000"
parseVND("1.500.000")    // 1500000

// Categories (Vietnamese)
type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'
classifyTransaction('highlands coffee') // 'Ăn uống'
```

`CATEGORY_TAXONOMY` maps merchant keywords → Category. Used in fixtures and filter UI.

---

## Styling Conventions (Tailwind v4)

Custom utility classes defined in `index.css`:

| Class | Purpose |
|-------|---------|
| `.heading-h1/h2/h3/label` | Typography scale |
| `.body-base`, `.body-sm` | Body text |
| `.card-padding`, `.card-gap` | Card spacing |
| `.section-spacing`, `.section-padding-x/y` | Page sections |
| `.touch-target` | min 44×44px (WCAG) |

**Color system:** OKLch variables for light/dark mode. Always use `--color-*` CSS vars, not hardcoded colors. Dark mode via `.dark` class on `<html>`.

---

## Test Patterns

- **Location:** Colocated — `Feature.test.tsx` next to `Feature.tsx`
- **MSW in tests:** Import from `src/mocks/server.ts` (Node setup)
- **Setup file:** `src/test-setup.ts` (jest-dom + scrollIntoView mock)
- **Run tests:** `npm run test` (Vitest)
- **Coverage:** `npm run test:coverage`

Standard test wrapper:
```ts
import { renderWithProviders } from '@/test-utils' // QueryClient + Router
```

---

## QueryClient Config (App.tsx)

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
```

---

## Routes

| Path | Component |
|------|-----------|
| `/` | Redirects → `/accounts` |
| `/dashboard` | DashboardPage |
| `/accounts` | BankAccountsPage |
| `/credit-cards` | CreditCardsPage |

Layout: `AppShell` wraps all routes via `<Outlet>`.

---

## localStorage Keys

| Key | Store | Content |
|-----|-------|---------|
| `finance-budgets` | budgetStore | Category → number budget map |
| `finance-chat-history` | chatStore | Message array |
| `finance-chat-api-config` | chatStore | Anthropic API key + model |
| `finance-theme` | themeStore | `'light'` or `'dark'` |

---

## Path Alias

`@/` resolves to `./src/` — configured in `vite.config.ts`, `tsconfig.app.json`, and `tsconfig.json`.
Always use `@/` for imports within `src/`.

---

## TypeScript Strictness

Full strict mode active: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- No `any` — use `unknown` and narrow
- No unused vars — prefix with `_` only if genuinely unused parameter
- Use `z.infer<typeof Schema>` for API types, never hand-write duplicates

---

## Adding New Features — Checklist

1. **Type:** Add Zod schema to `src/types/` and infer TypeScript type
2. **Service:** Add fetch function in `src/services/` with Zod parse
3. **Mock:** Add handler in `src/mocks/handlers.ts` + fixture data
4. **Hook:** Create TanStack Query hook in `src/hooks/`
5. **Store:** If UI state needed, add Zustand store in `src/stores/`
6. **Component:** Add to appropriate `src/features/` folder
7. **Tests:** Colocate `.test.ts(x)` file with each new file
8. **Filter in queryKey:** If filters apply, include all filter params

---

## Known Constraints

- No real backend — MSW intercepts all `/api/*` requests
- No auth yet — placeholder interceptor in apiClient.ts
- Recharts must stay lazy-loaded (large bundle)
- Anthropic SDK calls go client-side (chatbot) — API key stored in localStorage
- React 19 StrictMode — effects run twice in dev; tests must be idempotent
