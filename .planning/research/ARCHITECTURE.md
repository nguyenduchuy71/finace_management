# Architecture Research

**Domain:** Personal Finance Dashboard — v1.1 feature integration into existing React + Zustand + TanStack Query app
**Researched:** 2026-03-08
**Confidence:** HIGH (based on direct codebase inspection of all relevant source files)

---

## Standard Architecture

### System Overview (Current + v1.1 additions marked)

```
+---------------------------------------------------------------------+
|                          Pages (src/pages/)                          |
|  +-----------------+  +------------------+  +--------------------+  |
|  |  DashboardPage  |  | BankAccountsPage |  |  CreditCardsPage   |  |
|  |  [MOD v1.1]     |  |  (unchanged)     |  |  (unchanged)       |  |
|  +--------+--------+  +--------+---------+  +----------+---------+  |
|           |                    |                        |            |
+---------------------------------------------------------------------+
|                   Feature Components (src/features/)                 |
|                                                                      |
|  dashboard/                                                          |
|  +---------------+  +-----------------+  +------------------------+ |
|  | StatCard [MOD]|  | CategoryChart   |  | BudgetSection [NEW]    | |
|  | +delta props  |  | (unchanged)     |  | BudgetProgress [NEW]   | |
|  +---------------+  +-----------------+  +------------------------+ |
|                                                                      |
|  transactions/                                                       |
|  +-------------------+  +--------------------------------------+    |
|  | TransactionRow    |  | TransactionList (unchanged)          |    |
|  | [MOD +CategoryBadge] | TransactionListSkeleton (unchanged)  |    |
|  +-------------------+  +--------------------------------------+    |
|                                                                      |
|  creditCards/                                                        |
|  +---------------------------+                                       |
|  | CreditCardTransactionRow  |                                       |
|  | [MOD +CategoryBadge]      |                                       |
|  +---------------------------+                                       |
|                                                                      |
|  chatbot/                                                            |
|  +------------------+  +-------------------+  +-----------------+   |
|  | ChatPanel [MOD]  |  | ChatMessage       |  | ChatSettings    |   |
|  | wires in starters|  | (already has copy)|  | [minor polish]  |   |
|  +------------------+  +-------------------+  +-----------------+   |
|  +---------------------------+                                       |
|  | ConversationStarters [NEW]|                                       |
|  +---------------------------+                                       |
|                                                                      |
|  components/filters/                                                 |
|  +-----------------------------+  +----------------------------+    |
|  | FilterBar [MOD]             |  | CategoryFilter [NEW]       |    |
|  | +CategoryFilter +ExportBtn  |  | Select for category filter |    |
|  +-----------------------------+  +----------------------------+    |
|                                                                      |
+---------------------------------------------------------------------+
|                    Hooks / Data Layer (src/hooks/)                   |
|  +-------------------+  +--------------------+  +-----------------+ |
|  | useTransactions   |  | useDashboardStats  |  | useExport [NEW] | |
|  | (unchanged —      |  | [MOD: +prev period |  | cache read +    | |
|  |  categoryId flows |  |  parallel query]   |  | Blob download   | |
|  |  via queryKey)    |  |                    |  |                 | |
|  +-------------------+  +--------------------+  +-----------------+ |
+---------------------------------------------------------------------+
|                    State Layer (src/stores/)                         |
|  +------------------+  +-----------------+  +-------------------+  |
|  | filterStore [MOD]|  | dashboardStore  |  | chatStore         |  |
|  | +categoryId field|  | (unchanged)     |  | (unchanged)       |  |
|  +------------------+  +-----------------+  +-------------------+  |
|  +------------------+  +-----------------+                          |
|  | categoryStore    |  | budgetStore     |                          |
|  | [NEW] overrides  |  | [NEW] monthly   |                          |
|  | localStorage     |  | limits, local   |                          |
|  +------------------+  +-----------------+                          |
+---------------------------------------------------------------------+
|                  Service / Mock Layer                                |
|  +-----------------+  +---------------------+  +-----------------+ |
|  | services/       |  | services/dashboard.ts|  | mocks/          | |
|  | accounts.ts     |  | [unchanged — two     |  | handlers.ts     | |
|  | (unchanged)     |  |  separate API calls  |  | [MOD: prev      | |
|  |                 |  |  used in v1.1]       |  |  period dates]  | |
|  +-----------------+  +---------------------+  +-----------------+ |
+---------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Status in v1.1 |
|-----------|----------------|----------------|
| `filterStore` | Transaction list UI filter state | Modified — add `categoryId` field + `setCategory` action |
| `categoryStore` | User category overrides, localStorage persist | New |
| `budgetStore` | Monthly budgets per category, localStorage persist | New |
| `dashboardStore` | Dashboard date range, independent of filterStore | Unchanged |
| `chatStore` | Chat messages, API config, open/close state | Unchanged |
| `useDashboardStats` | Fetches current + previous period stats in parallel | Modified |
| `useExport` | Reads TanStack Query cache, generates CSV Blob, triggers download | New |
| `TransactionRow` | Bank transaction row | Modified — add CategoryBadge |
| `CreditCardTransactionRow` | CC transaction row | Modified — add CategoryBadge |
| `FilterBar` | Filter controls row | Modified — add CategoryFilter + Export button |
| `CategoryFilter` | Dropdown for category filter | New |
| `StatCard` | Income/expense summary card | Modified — add optional delta/deltaPercent props |
| `BudgetProgress` | Single category: progress bar + inline budget input | New |
| `BudgetSection` | Container for all BudgetProgress rows on DashboardPage | New |
| `DashboardPage` | Page orchestrator | Modified — add BudgetSection, pass previousData to StatCards |
| `ChatPanel` | Chat UI shell | Modified — wire in ConversationStarters |
| `ChatMessage` | Message bubble with copy/regenerate/delete | Unchanged (copy button already present) |
| `ChatSettings` | API key/model panel | Minor visual polish only |
| `ConversationStarters` | Prompt chip list shown when messages.length === 0 | New |

---

## Recommended Project Structure (v1.1 delta view)

```
src/
+-- features/
|   +-- dashboard/
|   |   +-- StatCard.tsx                [MOD] add optional delta + deltaPercent props
|   |   +-- StatCardSkeleton.tsx        [unchanged]
|   |   +-- CategoryChart.tsx           [unchanged]
|   |   +-- CategoryChartSkeleton.tsx   [unchanged]
|   |   +-- DashboardDatePicker.tsx     [unchanged]
|   |   +-- SourceSubtotals.tsx         [unchanged]
|   |   +-- BudgetProgress.tsx          [NEW] single category: bar + inline input
|   |   +-- BudgetSection.tsx           [NEW] renders all category BudgetProgress rows
|   |
|   +-- transactions/
|   |   +-- TransactionRow.tsx          [MOD] add CategoryBadge after merchant name
|   |   +-- TransactionList.tsx         [unchanged]
|   |   +-- TransactionListSkeleton.tsx [unchanged]
|   |   +-- TransactionEmptyState.tsx   [unchanged]
|   |
|   +-- creditCards/
|   |   +-- CreditCardTransactionRow.tsx [MOD] add CategoryBadge
|   |   +-- (all other files unchanged)
|   |
|   +-- chatbot/
|       +-- ChatPanel.tsx               [MOD] replace hardcoded empty state with ConversationStarters
|       +-- ChatMessage.tsx             [unchanged — copy already exists]
|       +-- ChatSettings.tsx            [minor polish — label spacing, model selector]
|       +-- ChatInput.tsx               [unchanged]
|       +-- ChatButton.tsx              [unchanged]
|       +-- ConversationStarters.tsx    [NEW] clickable prompt chips
|       +-- useChatApi.ts               [unchanged]
|
+-- components/
|   +-- filters/
|   |   +-- FilterBar.tsx               [MOD] add CategoryFilter + ExportButton
|   |   +-- CategoryFilter.tsx          [NEW] shadcn Select bound to filterStore.categoryId
|   |   +-- SearchInput.tsx             [unchanged]
|   |   +-- DateRangePicker.tsx         [unchanged]
|   |   +-- TransactionTypeFilter.tsx   [unchanged]
|   +-- ui/ (all unchanged — shadcn primitives)
|
+-- stores/
|   +-- filterStore.ts                  [MOD] add categoryId: string|null + setCategory action
|   +-- categoryStore.ts                [NEW] overrides: Record<txId, category>, localStorage
|   +-- budgetStore.ts                  [NEW] budgets: Record<category, number>, localStorage
|   +-- dashboardStore.ts               [unchanged]
|   +-- chatStore.ts                    [unchanged]
|   +-- themeStore.ts                   [unchanged]
|
+-- hooks/
|   +-- useTransactions.ts              [unchanged — categoryId in filterStore flows into queryKey]
|   +-- useDashboardStats.ts            [MOD] add parallel previous-period query
|   +-- useExport.ts                    [NEW] synchronous cache read + Blob download
|   +-- useAccounts.ts                  [unchanged]
|   +-- useCreditCards.ts               [unchanged]
|   +-- useCreditCardTransactions.ts    [unchanged]
|   +-- useDebounced.ts                 [unchanged]
|
+-- services/
|   +-- dashboard.ts                    [unchanged — two separate calls handle prev period]
|   +-- accounts.ts                     [unchanged]
|   +-- apiClient.ts                    [unchanged]
|   +-- creditCards.ts                  [unchanged]
|
+-- utils/
|   +-- categories.ts                   [NEW] merchant map + resolveCategory() pure function
|   +-- export.ts                       [NEW] transactionsToCsv() pure function
|   +-- dates.ts                        [MOD] add getPreviousPeriod() export
|   +-- currency.ts                     [unchanged]
|   +-- billingCycle.ts                 [unchanged]
|
+-- mocks/
|   +-- handlers.ts                     [MOD] /dashboard/stats handler returns period-filtered data
|   +-- fixtures/ (all unchanged — transactions already have category field set)
|
+-- types/
    +-- account.ts                      [unchanged — Transaction.category: string|undefined exists]
    +-- creditCard.ts                   [unchanged]
    +-- api.ts                          [unchanged]
```

### Structure Rationale

- **categoryStore and budgetStore** go in `src/stores/` alongside existing stores. Both use the same manual localStorage pattern already established in `chatStore.ts`.
- **categories.ts and export.ts** go in `src/utils/` as pure functions. They have no React dependencies and are trivially testable.
- **BudgetProgress and BudgetSection** go in `src/features/dashboard/` — they are specific to the dashboard domain, not shared primitives.
- **ConversationStarters** goes in `src/features/chatbot/` — chatbot-domain component, not shared UI.
- **CategoryFilter** goes in `src/components/filters/` alongside the other filter controls it joins in FilterBar.

---

## Architectural Patterns

### Pattern 1: Zustand Store with Manual localStorage Persistence

**What:** Zustand store with manual load-on-init and save-on-every-mutation. This exact pattern already exists in `chatStore.ts` for messages and API config.

**When to use:** Client-only state that must survive page refresh. `categoryStore` (user overrides) and `budgetStore` (monthly limits) both qualify — no server sync needed.

**Trade-offs:** Simple with no external dependency. Risk of stale data if user clears storage, but acceptable for a personal-use app.

**Example (categoryStore):**
```typescript
// src/stores/categoryStore.ts
import { create } from 'zustand'

const OVERRIDES_KEY = 'finance-category-overrides'

function loadOverrides(): Record<string, string> {
  try {
    const stored = localStorage.getItem(OVERRIDES_KEY)
    return stored ? (JSON.parse(stored) as Record<string, string>) : {}
  } catch { return {} }
}

interface CategoryState {
  overrides: Record<string, string>  // txId -> category
  setOverride: (txId: string, category: string) => void
  removeOverride: (txId: string) => void
}

export const useCategoryStore = create<CategoryState>()((set) => ({
  overrides: loadOverrides(),
  setOverride: (txId, category) =>
    set((s) => {
      const overrides = { ...s.overrides, [txId]: category }
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
      return { overrides }
    }),
  removeOverride: (txId) =>
    set((s) => {
      const { [txId]: _, ...rest } = s.overrides
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(rest))
      return { overrides: rest }
    }),
}))
```

### Pattern 2: Category Resolution as a Pure Utility Function

**What:** `resolveCategory(tx, overrides)` checks user overrides first, falls back to the `tx.category` field from the API, then consults a static merchant-name map, then returns `'other'`. No hook, no TanStack Query — pure local computation called per-render inside `TransactionRow`.

**When to use:** Every render of `TransactionRow` and `CreditCardTransactionRow`.

**Trade-offs:** Merchant map lives in client code, not the server. Updates require a code deploy. For a personal-use app this is fine. The map must be kept in sync with the fixture categories.

**Known edge case:** `Grab` appears as both food delivery and ride-hailing. Use a description-substring heuristic: if `tx.description.toLowerCase().includes('đồ ăn')` classify as `food`, otherwise `transport`.

```typescript
// src/utils/categories.ts
export const CATEGORY_LABELS: Record<string, string> = {
  food:        'Ăn uống',
  transport:   'Di chuyển',
  shopping:    'Mua sắm',
  grocery:     'Thực phẩm',
  electronics: 'Điện tử',
  income:      'Thu nhập',
  transfer:    'Chuyển khoản',
  other:       'Khác',
}

const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  'Circle K':         'food',
  'Highlands Coffee': 'food',
  'The Coffee House': 'food',
  'Phúc Long':        'food',
  'Lotteria':         'food',
  'Grab':             'transport',  // see description heuristic below
  'Shopee':           'shopping',
  'Lazada':           'shopping',
  'AEON Mall':        'shopping',
  'Bách Hoá Xanh':    'grocery',
  'VinMart':          'grocery',
  'Điện Máy Xanh':    'electronics',
}

export function resolveCategory(
  tx: { id: string; merchantName?: string; description: string; category?: string },
  overrides: Record<string, string>
): string {
  if (overrides[tx.id]) return overrides[tx.id]
  if (tx.category) return tx.category
  if (tx.merchantName) {
    if (tx.merchantName === 'Grab') {
      return tx.description.toLowerCase().includes('đồ ăn') ? 'food' : 'transport'
    }
    if (MERCHANT_CATEGORY_MAP[tx.merchantName]) return MERCHANT_CATEGORY_MAP[tx.merchantName]
  }
  return 'other'
}
```

### Pattern 3: Dual-Period Dashboard — Two Parallel useQuery Calls

**What:** `useDashboardStats` fires two `useQuery` calls simultaneously — current period and previous period. Both share the same staleTime. The hook merges results before returning.

**When to use:** Month-over-month comparison on StatCards.

**Trade-offs:** Two API calls instead of one. In MSW dev mode this is invisible to the user. For a real API in v1.2, a single endpoint with `?includePrevious=true` would be more efficient, but that requires a backend change. The two-call approach avoids any API contract change for v1.1.

**Implementation pattern:**
```typescript
// src/hooks/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@/services/dashboard'
import { useDashboardDateRange } from '@/stores/dashboardStore'
import { getPreviousPeriod } from '@/utils/dates'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardDateRange()
  const { prevFrom, prevTo } = getPreviousPeriod(dateFrom, dateTo)

  const current = useQuery({
    queryKey: ['dashboardStats', { dateFrom, dateTo }],
    queryFn: () => getDashboardStats({ dateFrom, dateTo }),
    staleTime: 1000 * 60 * 5,
  })

  const previous = useQuery({
    queryKey: ['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }],
    queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }),
    staleTime: 1000 * 60 * 5,
  })

  return {
    data: current.data,
    previousData: previous.data,
    isLoading: current.isLoading || previous.isLoading,
    isError: current.isError,
    refetch: current.refetch,
  }
}
```

`getPreviousPeriod` is added to `src/utils/dates.ts`. When `dateFrom`/`dateTo` are null (no range selected), it defaults to "last calendar month vs the month before last."

### Pattern 4: CSV Export via TanStack Query Cache Read

**What:** `useExport` reads the `infiniteQuery` cache synchronously using `queryClient.getQueryData()` with the same key shape as `useTransactions`. No network call is made. A `Blob` is created, an object URL generated, and a synthetic `<a>` click triggers the browser download dialog.

**When to use:** Export button click.

**Trade-offs:** Only exports pages that have been loaded (user has scrolled to). For this app with ~70–130 total transactions, all data is typically loaded after a few "Load more" clicks or the full list is visible. This is acceptable. Document this limitation in the UI ("Xuất giao dịch đã tải").

```typescript
// src/hooks/useExport.ts
import { useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { useFilterParams } from '@/stores/filterStore'
import { transactionsToCsv } from '@/utils/export'
import type { TransactionPage } from '@/services/accounts'

export function useExport() {
  const queryClient = useQueryClient()
  const { accountId, dateFrom, dateTo, searchQuery, txType, categoryId } = useFilterParams()

  function exportCsv() {
    const cached = queryClient.getQueryData<InfiniteData<TransactionPage>>(
      ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, categoryId }]
    )
    const transactions = cached?.pages.flatMap((p) => p.data) ?? []
    if (transactions.length === 0) return

    const csv = transactionsToCsv(transactions)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `giao-dich-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { exportCsv }
}
```

Note: `'\uFEFF'` BOM prefix ensures Excel on Windows correctly opens the UTF-8 CSV with Vietnamese characters.

---

## Data Flow

### Feature 1: Transaction Categories

```
TransactionRow renders
  |
  v
useCategoryStore() -> overrides object (useShallow selector)
  |
  v
resolveCategory(tx, overrides) -> category string (pure computation)
  |
  v
CategoryBadge renders with label from CATEGORY_LABELS[category]

-- User overrides category --
User clicks badge -> category picker dropdown opens
  |
  v
categoryStore.setOverride(tx.id, newCategory)
  |
  v  (Zustand state update, localStorage saved)
CategoryBadge re-renders with new category (no network call)

-- Category filter --
CategoryFilter.onChange -> filterStore.setCategory(categoryId)
  |
  v  (filterStore.categoryId changes)
useTransactions queryKey changes: ['transactions', accountId, { ..., categoryId }]
  |
  v  (TanStack Query cache miss -> new fetch)
MSW handler: filter fixture transactions where category === categoryId
  |
  v
TransactionList re-renders with filtered results
```

### Feature 2: Budget Tracking

```
DashboardPage renders
  |
  v
useDashboardStats() -> data.categoryBreakdown (already computed by API)
  |
  v  (no new API call for budgets)
budgetStore.budgets (from localStorage) -> per-category monthly limits
  |
  v
BudgetSection iterates categoryBreakdown, renders BudgetProgress per row
  |
  v
BudgetProgress:
  spent = categoryBreakdown[category].amount (absolute value)
  limit = budgetStore.budgets[category] ?? 0
  percent = limit > 0 ? Math.min(spent / limit * 100, 100) : 0
  warning = percent >= 80

-- User sets/edits budget --
User types in BudgetProgress input -> budgetStore.setBudget(category, amount)
  |
  v  (Zustand update, localStorage saved)
BudgetProgress re-renders with new percent (no network call)
```

### Feature 3: Month-over-Month

```
DashboardPage renders
  |
  v
useDashboardStats() fires TWO parallel queries:
  Query A: ['dashboardStats', { dateFrom, dateTo }]       -> current period
  Query B: ['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }] -> prev period
  |
  v  (both resolve; MSW handler returns period-appropriate sums)
DashboardPage receives { data, previousData }
  |
  v
StatCard (income):
  amount = data.totalIncome
  previousAmount = previousData?.totalIncome
  delta = amount - (previousAmount ?? 0)
  deltaPercent = previousAmount ? (delta / previousAmount * 100) : null
  |
  v
DeltaBadge renders: arrow icon + percentage (green if positive, red if negative)
```

### Feature 4: Chatbot UX

```
ChatPanel renders
  |
  v
messages.length === 0 && !isLoading
  ? <ConversationStarters onSelect={fn} />
  : messages.map(<ChatMessage />)

-- User clicks starter prompt --
ConversationStarters.onSelect(promptText)
  |
  v
Calls same handler as ChatInput submit (via shared prop or chatStore action)
  |
  v
Existing useChatApi flow (unchanged)

-- ChatMessage: no change needed --
Copy, regenerate, delete buttons already implemented in ChatMessage.tsx
ChatSettings: visual-only improvements, no data flow change
```

### Feature 5: CSV Export

```
User clicks Export button in FilterBar
  |
  v
useExport().exportCsv()
  |
  v  (synchronous, no network)
queryClient.getQueryData(['transactions', accountId, { ...filterParams }])
  -> InfiniteData<TransactionPage> | undefined
  |
  v
transactions = pages.flatMap(p => p.data)
  |
  v
transactionsToCsv(transactions) -> CSV string
  (columns: Date, Description, Merchant, Category, Type, Amount VND, Status)
  |
  v
new Blob(['\uFEFF' + csv], { type: 'text/csv' })
  |
  v
URL.createObjectURL(blob) -> synthetic <a> click -> browser download dialog
URL.revokeObjectURL(url)  -> cleanup
```

---

## Integration Points

### New Files (create from scratch)

| File | Depends On | Consumed By |
|------|-----------|-------------|
| `src/utils/categories.ts` | nothing (pure) | `TransactionRow`, `CreditCardTransactionRow`, `CategoryFilter` |
| `src/utils/export.ts` | `src/utils/currency.ts`, `src/utils/dates.ts` | `src/hooks/useExport.ts` |
| `src/stores/categoryStore.ts` | zustand | `TransactionRow`, `CreditCardTransactionRow` |
| `src/stores/budgetStore.ts` | zustand | `BudgetProgress`, `BudgetSection` |
| `src/hooks/useExport.ts` | TanStack Query, `utils/export.ts`, `filterStore` | `FilterBar` (ExportButton) |
| `src/features/dashboard/BudgetProgress.tsx` | `budgetStore`, shadcn Progress | `BudgetSection` |
| `src/features/dashboard/BudgetSection.tsx` | `BudgetProgress`, `budgetStore`, `useDashboardStats` | `DashboardPage` |
| `src/features/chatbot/ConversationStarters.tsx` | `chatStore` or props only | `ChatPanel` |
| `src/components/filters/CategoryFilter.tsx` | `filterStore`, shadcn Select | `FilterBar` |

### Modified Files (surgical changes)

| File | What Changes | Risk |
|------|-------------|------|
| `src/stores/filterStore.ts` | Add `categoryId: string \| null` + `setCategory` action. Add `categoryId` to `useFilterParams` selector. | LOW — additive only; existing consumers unaffected |
| `src/hooks/useDashboardStats.ts` | Add second `useQuery` for previous period; return `previousData`. | LOW — existing query unchanged; second is additive |
| `src/utils/dates.ts` | Add `getPreviousPeriod(dateFrom, dateTo)` export. | LOW — new export, no changes to existing functions |
| `src/features/transactions/TransactionRow.tsx` | Import `resolveCategory` + `useCategoryStore`; render `<CategoryBadge>` below merchant name. | LOW — layout addition only |
| `src/features/creditCards/CreditCardTransactionRow.tsx` | Same CategoryBadge addition. | LOW |
| `src/components/filters/FilterBar.tsx` | Add `<CategoryFilter />` and `<ExportButton>`. May need `flex-wrap` adjustment for 5 controls on mobile. | LOW |
| `src/pages/DashboardPage.tsx` | Add `<BudgetSection>` below chart grid; pass `previousData` from hook to `StatCard`. | LOW |
| `src/features/dashboard/StatCard.tsx` | Add optional `delta?: number` and `deltaPercent?: number` props; render `<DeltaBadge>` when provided. Existing renders unchanged. | LOW — additive props with defaults |
| `src/features/chatbot/ChatPanel.tsx` | Replace hardcoded empty-state JSX with `<ConversationStarters onSelect={...} />`. | LOW |
| `src/mocks/handlers.ts` | `/dashboard/stats` handler must return period-filtered data when called with previous-period dates; currently likely returns same fixture for all date params. | MEDIUM — handler logic needs date-aware filtering or a static previous-period fixture |

### Internal Module Boundaries — No Circular Deps

| Boundary | Communication | Notes |
|----------|--------------|-------|
| `categoryStore` -> `TransactionRow` | Direct Zustand subscribe with `useShallow` | No TanStack Query involvement |
| `budgetStore` -> `BudgetSection` | Direct Zustand subscribe | Reads `useDashboardStats` data separately for amounts |
| `filterStore.categoryId` -> `useTransactions` | Via queryKey — `useFilterParams` must include `categoryId` | Critical: if omitted from `useFilterParams`, filter changes won't trigger refetch |
| `useExport` -> TanStack Query cache | `queryClient.getQueryData()` synchronous read | Key shape must match `useTransactions` exactly |
| `useDashboardStats` -> `StatCard` | Props through `DashboardPage` | `previousData` is optional; StatCard degrades gracefully if null |
| `utils/categories.ts` | Pure function — no imports from stores or hooks | Safe to import from any component |
| `utils/export.ts` | Pure function — imports only from `utils/currency.ts` and `utils/dates.ts` | Safe to import from hook |

---

## Build Order

Build in this sequence to respect cross-feature dependencies.

### Step 1: Transaction Categories

Build first because `categoryStore` and `utils/categories.ts` are prerequisites for Budget Tracking (budgets are per-category). Also unblocks the category filter in FilterBar and the categoryId addition to filterStore.

Files to create:
- `src/utils/categories.ts` — merchant map + `resolveCategory()` + `CATEGORY_LABELS`
- `src/stores/categoryStore.ts` — user overrides with localStorage

Files to modify:
- `src/stores/filterStore.ts` — add `categoryId` + `setCategory` + include in `useFilterParams`
- `src/features/transactions/TransactionRow.tsx` — add CategoryBadge
- `src/features/creditCards/CreditCardTransactionRow.tsx` — add CategoryBadge
- `src/components/filters/CategoryFilter.tsx` — new component (shadcn Select)
- `src/components/filters/FilterBar.tsx` — add CategoryFilter (ExportButton can come in Step 4)

No circular dependency risk: `categoryStore` is a leaf store. `resolveCategory` is a pure function.

### Step 2: Budget Tracking

Build second because it requires Step 1's category definitions. Reuses `categoryBreakdown` already in `useDashboardStats` response — no new API work needed.

Check if shadcn `progress` component is already installed (`src/components/ui/progress.tsx`). If not: `npx shadcn@latest add progress`.

Files to create:
- `src/stores/budgetStore.ts` — budgets per category, localStorage
- `src/features/dashboard/BudgetProgress.tsx` — progress bar + inline number input
- `src/features/dashboard/BudgetSection.tsx` — renders all categories present in `categoryBreakdown`

Files to modify:
- `src/pages/DashboardPage.tsx` — add `<BudgetSection categoryBreakdown={data?.categoryBreakdown} />` below chart grid

### Step 3: Month-over-Month Dashboard

Build third because it is self-contained to the dashboard layer. Does not depend on categories or budgets. Place after Step 2 to avoid simultaneous edits to `DashboardPage.tsx`.

Files to modify:
- `src/utils/dates.ts` — add `getPreviousPeriod(dateFrom, dateTo)` pure function
- `src/hooks/useDashboardStats.ts` — add parallel previous-period query, return `previousData`
- `src/features/dashboard/StatCard.tsx` — add optional `delta` + `deltaPercent` props + DeltaBadge
- `src/pages/DashboardPage.tsx` — pass `previousData` from hook to StatCards
- `src/mocks/handlers.ts` — update `/dashboard/stats` to return date-filtered fixture sums for previous period

MSW handler note: The current handler most likely ignores date params and returns the same computed total. For month-over-month to work correctly in dev, the handler must compute period-specific totals from fixture data. The simplest approach is to filter `mockTransactions` by `dateFrom`/`dateTo` query params and compute totals on the fly, mirroring the production API behavior.

### Step 4: CSV Export

Build fourth because it is independent of categories, budgets, and dashboard. The only dependency is that `filterStore.categoryId` must be in the queryKey (done in Step 1). Place here to avoid FilterBar conflicts while Step 1 adds CategoryFilter.

Files to create:
- `src/utils/export.ts` — `transactionsToCsv()` pure function (header row, VND formatting, date formatting, BOM prefix)
- `src/hooks/useExport.ts` — cache reader + Blob download trigger

Files to modify:
- `src/components/filters/FilterBar.tsx` — add ExportButton that calls `useExport().exportCsv()`

### Step 5: Chatbot UX Polish

Build last. Entirely self-contained. No store dependencies on other v1.1 features. Lowest regression risk — makes a good final step.

Pre-check: `ChatMessage.tsx` already has copy button, regenerate button, and delete button. The CHAT-UX requirements for copy and message actions may already be met. Verify against the milestone spec before spending time here.

Files to create:
- `src/features/chatbot/ConversationStarters.tsx` — 3–5 clickable prompt chips (e.g., "Chi tiêu nhiều nhất tháng này?", "So sánh thu chi tháng này với tháng trước")

Files to modify:
- `src/features/chatbot/ChatPanel.tsx` — replace hardcoded empty-state div with `<ConversationStarters onSelect={handleStarterSelect} />`
- `src/features/chatbot/ChatSettings.tsx` — visual polish (label alignment, better model selector options)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching Categories from an API Endpoint

**What people do:** Add a `/categories` route to MSW handlers, create a `categoriesService.ts`, build a `useCategories()` hook with TanStack Query.

**Why it's wrong:** Categories are a local classification concern for this app. The `Transaction.category` field already comes from the API fixture. User overrides are in `categoryStore` (localStorage). Adding an API call adds latency, a new cache entry, and MSW handler complexity for no benefit.

**Do this instead:** Keep category resolution in `utils/categories.ts` as a pure function. `categoryStore` is the only state layer needed.

### Anti-Pattern 2: Storing Budget State in TanStack Query

**What people do:** Use `useQuery` with a `queryFn` that reads from localStorage, treating budgets as server-like state.

**Why it's wrong:** Budgets are local user preferences. TanStack Query adds loading states, staleTime, gcTime, and refetch logic for data that is synchronously available from a local store.

**Do this instead:** Zustand store with manual localStorage persistence — same pattern as `chatStore.ts`. Synchronous reads, instant updates, no loading states.

### Anti-Pattern 3: Merging dashboardStore into filterStore

**What people do:** Add dashboard date range to `filterStore` since both are "filter state."

**Why it's wrong:** The existing codebase intentionally separates them. `dashboardStore` being independent of `filterStore` allows users to view a "January dashboard" while the transaction list is filtered to February. Merging breaks this UX contract established in v1.0.

**Do this instead:** Keep `dashboardStore` independent. `categoryId` belongs in `filterStore` (it affects the transaction list). Dashboard budget monthly period is implicit (derived from dashboard date range) — no new store field needed.

### Anti-Pattern 4: Making a New API Call for CSV Export

**What people do:** Add an `/export` endpoint or loop through all transaction pages with fresh fetch calls.

**Why it's wrong:** TanStack Query's `infiniteQuery` cache already contains all loaded pages. A network call is redundant and slower than a synchronous cache read.

**Do this instead:** `queryClient.getQueryData()` with the same queryKey shape as `useTransactions`. The cache read is synchronous. Document that export covers loaded pages only (acceptable for ~70–130 total transactions in this app).

### Anti-Pattern 5: Adding a New Store for Previous-Period Date Range

**What people do:** Create a `comparisonStore` or `previousPeriodStore` to hold the previous month's date range.

**Why it's wrong:** The previous period is entirely derived from the current dashboard date range — it is not independently configurable. Adding a store for derived data violates the principle that stores hold only non-derivable state.

**Do this instead:** Compute `getPreviousPeriod(dateFrom, dateTo)` inline in `useDashboardStats` using a pure utility function. No new store needed.

### Anti-Pattern 6: Skipping useShallow on New Store Selectors

**What people do:** `const { overrides } = useCategoryStore()` — destructuring without `useShallow`.

**Why it's wrong:** `useCategoryStore()` without `useShallow` returns a new object reference on every render, causing infinite re-render loops in components that read multiple fields. This bug already caused issues during v1.0 and was fixed with the Zustand v5 double-curry + `useShallow` pattern.

**Do this instead:** Follow the established pattern from `filterStore.ts`:
```typescript
export function useCategoryOverrides() {
  return useCategoryStore(useShallow((s) => ({ overrides: s.overrides })))
}
```

---

## Scaling Considerations

This is a personal-use, single-user read-only app. The relevant concerns are bundle size and localStorage size, not server scaling.

| Concern | v1.0 state | v1.1 additions | Mitigation |
|---------|-----------|---------------|-----------|
| Bundle size | 525KB (already over 500KB target) | +~5KB for new utils/stores | No new heavy dependencies introduced; Recharts already lazy-loaded |
| localStorage | chat messages + API config | +category overrides, +budgets | Minimal: max ~200 tx overrides + ~10 budget entries, well under typical 5MB limit |
| Re-renders | useShallow on all multi-field selectors | New stores must follow same pattern | Follow useShallow pattern, no concern |
| TanStack Query cache | 1 infinite query per account + 1 dashboard query | +1 previous-period dashboard query | Adds one small object; no concern |
| MSW handler complexity | Simple fixture returns | Date-aware filtering for previous period | Handler must filter `mockTransactions` by date params; one-time implementation cost |

---

## Sources

- Direct codebase inspection (2026-03-08):
  - `src/stores/filterStore.ts` — confirmed Zustand v5 double-curry + useShallow pattern
  - `src/stores/chatStore.ts` — confirmed manual localStorage pattern to replicate
  - `src/stores/dashboardStore.ts` — confirmed independence from filterStore
  - `src/hooks/useDashboardStats.ts` — confirmed single-query structure to extend
  - `src/hooks/useTransactions.ts` — confirmed queryKey shape for export cache read
  - `src/services/dashboard.ts` — confirmed `DashboardStats.categoryBreakdown` already available
  - `src/features/transactions/TransactionRow.tsx` — confirmed layout structure for badge insertion
  - `src/features/chatbot/ChatPanel.tsx` — confirmed hardcoded empty state to replace
  - `src/features/chatbot/ChatMessage.tsx` — confirmed copy/regenerate/delete already implemented
  - `src/components/filters/FilterBar.tsx` — confirmed structure for new controls
  - `src/mocks/fixtures/transactions.ts` — confirmed all transactions have `category` field (food/transport/shopping/grocery/electronics/income/transfer)
  - `src/types/account.ts` — confirmed `Transaction.category: z.string().optional()` exists; no schema change needed

---
*Architecture research for: FinanceManager v1.1 feature integration*
*Researched: 2026-03-08*
