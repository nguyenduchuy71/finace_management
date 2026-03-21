# CLAUDE.md — FinanceManager Project Reference

## Overview

Personal finance dashboard (React + TypeScript + Vite) for managing bank accounts and credit card transactions. Uses Mock Service Worker (MSW) for development — no backend required.

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # VITE_ENABLE_MSW=true
npm run dev                  # http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (HMR) |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest watch mode |
| `npm run test:ui` | Interactive test UI |
| `npm run test:coverage` | Coverage report |

---

## Environment Variables

```bash
VITE_API_ENDPOINT=http://localhost:3000/api
VITE_ENABLE_MSW=true       # false in production (Vercel overrides automatically)
```

---

## Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **TanStack React Query 5** — data fetching & caching
- **Zustand 5** — state management
- **Zod 4** — schema validation at service boundary
- **Axios** — HTTP client
- **React Router DOM 7** — routing
- **Tailwind CSS 4** + **shadcn/radix-ui** — styling & UI
- **Recharts** — charts (lazy-loaded, ~372KB chunk)
- **MSW 2** — mock API
- **Sonner** — toast notifications
- **@anthropic-ai/sdk** — chatbot feature
- **@date-fns/tz** — Vietnam timezone (UTC+7)
- **papaparse** — CSV export

---

## Routing (`src/App.tsx`)

```
/              → redirect to /accounts
/dashboard     → DashboardPage
/accounts      → BankAccountsPage
/credit-cards  → CreditCardsPage
```

All routes wrapped in `<AppShell>` (header + layout + chat button/panel).

---

## Project Structure

```
src/
├── pages/               # DashboardPage, BankAccountsPage, CreditCardsPage
├── features/
│   ├── accounts/        # AccountTabs
│   ├── transactions/    # TransactionList, TransactionRow, Skeleton, EmptyState
│   ├── creditCards/     # CreditCardTabs, BillingCycleGroup, BillingCycleInfoCard
│   ├── dashboard/       # StatCard, CategoryChart, DashboardDatePicker, BudgetProgressSection
│   └── chatbot/         # ChatPanel, ChatMessage, ChatInput, ChatSettings, ChatButton
├── components/
│   ├── layout/          # AppShell, AppHeader
│   ├── filters/         # FilterBar, SearchInput, DateRangePicker, CategoryFilter, ExportButton
│   ├── budget/          # BudgetProgressBar, BudgetSettings
│   └── ui/              # shadcn components
├── hooks/               # useAccounts, useTransactions, useCreditCards, useCreditCardTransactions, useDashboardStats, useBudgetAlerts, useDebounced
├── services/            # apiClient (axios), accounts, creditCards, dashboard, exports
├── stores/              # filterStore, dashboardStore, budgetStore, categoryOverrideStore, chatStore, themeStore
├── types/               # api.ts, account.ts, creditCard.ts, budget.ts, categories.ts
├── utils/               # dates, currency, categories, csv, billingCycle
├── mocks/               # browser.ts, server.ts, handlers.ts, fixtures/
└── lib/utils.ts         # cn() = clsx + twMerge
```

---

## API Endpoints (Mock Handlers — `src/mocks/handlers.ts`)

### Bank Accounts
```
GET /api/accounts
  → PaginatedResponse<BankAccount>

GET /api/accounts/:accountId/transactions
  Query: cursor?, limit=20, search?, dateFrom?, dateTo?, txType?, category?
  → PaginatedResponse<Transaction>
```

### Credit Cards
```
GET /api/credit-cards
  → PaginatedResponse<CreditCard>

GET /api/credit-cards/:cardId/transactions
  Query: (same as bank transactions)
  → PaginatedResponse<CreditCardTransaction>
  Note: txType='income' always returns empty (CC = expenses only)
```

### Dashboard
```
GET /api/dashboard/stats
  Query: dateFrom?, dateTo?
  → DashboardStats { totalIncome, totalExpense, bankIncome, bankExpense, ccIncome, ccExpense, categoryBreakdown[], transactionCount }
```

---

## State Management (`src/stores/`)

| Store | Persisted | Description |
|---|---|---|
| `filterStore` | No | accountId, cardId, dateFrom, dateTo, searchQuery, txType, category |
| `dashboardStore` | No | Independent date range for dashboard page |
| `budgetStore` | localStorage | Budget amounts per Category |
| `categoryOverrideStore` | localStorage | User overrides for transaction categories |
| `chatStore` | localStorage | Chat messages, isOpen, apiConfig |
| `themeStore` | localStorage | 'light' \| 'dark' |

**Important:** Multi-field selectors must use `useShallow` to prevent infinite re-renders (Zustand v5).

---

## Custom Hooks (`src/hooks/`)

| Hook | Returns |
|---|---|
| `useAccounts()` | `{ data: BankAccount[], ... }` |
| `useTransactions()` | Infinite query, reads from filterStore |
| `useCreditCards()` | `{ data: CreditCard[], ... }` |
| `useCreditCardTransactions()` | Infinite query, reads from filterStore |
| `useDashboardStats()` | Current + previous month stats (month-over-month delta) |
| `useBudgetAlerts(breakdown, budgets)` | `{ alerts, warningCount, overbudgetCount }` — fires Sonner toasts |
| `useDebounced(value, delayMs)` | Debounced value |

---

## Types (`src/types/`)

```typescript
// account.ts
BankAccount { id, bankName, accountName, accountNumber, accountType, currency, balance, lastUpdated }
Transaction { id, accountId, amount, description, merchantName?, category?, type, status, transactionDate, postedDate? }
// amount: positive = income, negative = expense

// creditCard.ts
CreditCard { id, bankName, cardName, cardNumber, cardType, currency, creditLimit, currentBalance, statementDate, paymentDueDate, lastUpdated }
CreditCardTransaction { id, cardId, amount, description, merchantName, category?, type, status, transactionDate, billingCycleStart?, billingCycleEnd? }

// categories.ts
type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'

// api.ts
PaginatedResponse<T> { data: T[], nextCursor: string | null, total: number }
ApiError { code: string, message: string, details?: unknown }
```

---

## Utility Functions (`src/utils/`)

### Currency (`currency.ts`)
```typescript
formatVND(amount)         → "đ 1.500.000"
formatVNDSigned(amount)   → "- đ 500.000"
parseVND(str)             → number
```

### Dates (`dates.ts`)
```typescript
toVietnamDate(isoUtcString)             → TZDate (UTC+7)
formatDisplayDate(isoString)            → "15/01/2026"
formatDisplayDateTime(isoString)        → "15/01/2026 14:30"
calculateMonthDelta(current, previous)  → number | null (% change)
getPreviousMonthDateRange(from, to)     → { prevFrom, prevTo }
```

### Categories (`categories.ts`)
```typescript
classifyTransaction(merchantName?)  → Category   // Auto-classify by merchant keywords
getCategoryLabel(category)          → string
CATEGORY_TAXONOMY                   // Record<Category, string[]> keyword map
```

### CSV (`csv.ts`)
```typescript
formatTransactionForCSV(tx, accountOrCard?, overrides?)  → CSVTransactionRow
downloadCSV(csvString, filename)                         // UTF-8 BOM download
```

### Billing Cycle (`billingCycle.ts`)
```typescript
computeCurrentCycle(statementDay, nowISO)         → BillingCycle
groupTransactionsByCycle(txs, currentCycle)       → BillingCycleGroupData[]
formatCycleDateRange(startISO, endISO)            → { startDisplay, endDisplay }
```

---

## Mock Data Fixtures (`src/mocks/fixtures/`)

- **accounts.ts** — 2 bank accounts (Vietcombank checking, Techcombank savings)
- **transactions.ts** — 38 bank transactions (Dec 2025 – Feb 2026)
- **creditCards.ts** — 2 credit cards + 32 CC transactions (Techcombank Visa, VPBank Mastercard)

---

## Key Architecture Decisions

1. **MSW Deferred Render:** `ReactDOM.createRoot` called inside `enableMocking().then()` — mock API must be ready before React renders.
2. **Cursor-based Pagination:** `useInfiniteQuery` uses transaction ID as cursor (not page numbers) for stability with active filters.
3. **Filter Params in QueryKey:** TanStack Query auto-refetches when any filter changes — all filter values are part of queryKey.
4. **Zod at Service Boundary:** All API responses validated with Zod in service layer; components receive typed data only.
5. **Dashboard Store Separate:** `dashboardStore` is independent from `filterStore` — allows different date ranges simultaneously.
6. **Recharts Lazy-Loaded:** CategoryChart uses `React.lazy()` to split the 372KB recharts chunk.
7. **Vietnam Timezone:** All date display via `@date-fns/tz` (UTC+7) to avoid midnight UTC edge cases.
8. **Path Alias:** `@` → `src/` (configured in `vite.config.ts`).

---

## Deployment (Vercel)

- Install: `npm ci`
- Build: `npm run build` → `dist/`
- Env override: `VITE_ENABLE_MSW=false`
- Region: `sfo1`
