# Phase 2: Core Transaction Views - Research

**Researched:** 2026-03-03
**Domain:** React UI components, TanStack Query infinite pagination, Zustand filter wiring, shadcn/ui, MSW filter handlers
**Confidence:** HIGH

---

## Summary

Phase 2 converts the Phase 1 proof-of-concept render (a single hardcoded TransactionList in App.tsx) into a full read-only transaction browsing experience. The foundation is entirely in place: types, Zod schemas, service functions, MSW handlers with cursor pagination, and Zustand filter store are all ready. Phase 2 is pure UI construction on top of that foundation.

The three plans in the roadmap map cleanly to three technical domains: (1) transaction list components with loading/error/empty states using `useInfiniteQuery` + shadcn Skeleton, (2) filter and search controls wired to the existing Zustand store, and (3) page-level routing using React Router v7 with account/card switching.

The most important technical decision is **`useInfiniteQuery` over `useQuery` for all paginated lists**. The MSW handlers already implement cursor-based pagination returning `nextCursor`. TanStack Query v5's `useInfiniteQuery` is the correct hook — it manages the pages array automatically, provides `fetchNextPage`/`hasNextPage`/`isFetchingNextPage`, and handles refetching all pages correctly on invalidation. Using `useQuery` with manual state merging would be error-prone and unnecessary.

**Primary recommendation:** Build all three plans strictly against what's already wired — use `useInfiniteQuery`, consume the existing `useFilterStore` actions, and add only the shadcn components that are missing (card, badge, button, input, select, skeleton, tabs, popover, calendar). The MSW handlers need minor enhancement to filter by `searchQuery`, `dateFrom`, `dateTo`, and `txType` query params.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BANK-01 | User can view a list of all bank account transactions (debit/credit) | `useInfiniteQuery` on `/accounts/:id/transactions` with flat `pages[].data` render |
| BANK-02 | Each transaction shows: date, description, amount (VND integer format), transaction type | `formatVND` + `formatDisplayDate` already exist; `TransactionRow` component wraps them |
| BANK-03 | User can select individual bank accounts to view separately | Tabs or Select wired to `useFilterStore.setAccountId` — Tabs recommended for ≤4 accounts |
| BANK-04 | Transaction list supports pagination for large volumes | `useInfiniteQuery` + "Load More" button pattern; cursor pagination already in MSW handlers |
| CC-01 | User can view a list of transactions for each credit card | Parallel `useInfiniteQuery` on `/credit-cards/:id/transactions` |
| CC-02 | Each card transaction shows: date, merchant, amount, pending/posted status | `CreditCardTransactionRow` with Badge for status; `merchantName` field already in schema |
| FILTER-01 | User can filter transactions by date range (date range picker) | shadcn Calendar (mode="range") + Popover; connect to `useFilterStore.setDateRange` |
| FILTER-02 | User can filter by account/card | Already in Zustand: `setAccountId`/`setCardId`; exposed via account switcher UI |
| FILTER-03 | User can filter by transaction type (income/expense) | `txType` already in Zustand; ToggleGroup or Select with options: all/income/expense |
| FILTER-04 | User can search transactions by name/description | Debounced Input → `useFilterStore.setSearchQuery`; MSW handler needs filter-by-searchQuery |
| DASH-03 | All async states handled: loading skeleton, error message, empty state | shadcn Skeleton array; conditional render pattern per `isLoading`/`isError`/`data.length===0` |
</phase_requirements>

---

## Standard Stack

### Core (Already Installed — No New npm Installs)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @tanstack/react-query | ^5.90 | Infinite paginated data fetching | Installed — switch POC to `useInfiniteQuery` |
| zustand | ^5.0 | Filter/UI state store | Installed — `useFilterStore` already defined |
| react-router-dom | ^7.13 | Page routing + outlet layouts | Installed — needs Routes added to App.tsx |
| date-fns | ^4.1 | Date formatting in filters | Installed — `formatDisplayDate` already uses it |
| lucide-react | ^0.576 | Icons (calendar, search, filter) | Installed |
| msw | ^2.12 | Mock API with filter query params | Installed — handlers need filter param support |

### shadcn Components to Add (CLI)

| Component | Install Command | Use |
|-----------|----------------|-----|
| card | `npx shadcn@latest add card` | Transaction row container, account card |
| badge | `npx shadcn@latest add badge` | pending/posted status, income/expense label |
| button | `npx shadcn@latest add button` | Load More, Clear Filters, tab triggers |
| input | `npx shadcn@latest add input` | Text search field |
| select | `npx shadcn@latest add select` | Type filter (all/income/expense), fallback account select |
| skeleton | `npx shadcn@latest add skeleton` | Loading placeholder rows |
| tabs | `npx shadcn@latest add tabs` | Account switcher for ≤4 accounts |
| popover | `npx shadcn@latest add popover` | Date picker trigger container |
| calendar | `npx shadcn@latest add calendar` | Date range picker (mode="range") |

**Install all at once:**
```bash
npx shadcn@latest add card badge button input select skeleton tabs popover calendar
```

### No New npm Dependencies Needed

The entire Phase 2 feature set can be built from already-installed packages. Specifically:
- No `use-debounce` npm package — implement a `useDebounced` hook with `useState` + `useEffect`
- No `react-window` or virtualization — fixture data is 70+59 = ~129 rows, "Load More" button is sufficient
- No `date-fns/locale/vi` separate install — `date-fns` v4 bundles locales; `vi` is importable from `date-fns/locale`

---

## Architecture Patterns

### Recommended Project Structure for Phase 2

```
src/
  features/
    transactions/
      TransactionList.tsx          # useInfiniteQuery, renders rows, load more
      TransactionRow.tsx           # Single bank transaction row
      TransactionListSkeleton.tsx  # Loading skeleton (5 placeholder rows)
      TransactionEmptyState.tsx    # Empty state UI
    creditCards/
      CreditCardTransactionList.tsx
      CreditCardTransactionRow.tsx  # Shows merchantName + pending/posted badge
    accounts/
      AccountTabs.tsx              # Tabs for switching bank accounts
    dashboard/
      (placeholder for Phase 4 — leave empty)
  components/
    filters/
      DateRangePicker.tsx          # Calendar mode="range" in Popover
      TransactionTypeFilter.tsx    # Select: all/income/expense
      SearchInput.tsx              # Debounced text input
      FilterBar.tsx                # Composes all filter controls
    ui/                            # shadcn components (auto-generated)
  pages/
    BankAccountsPage.tsx           # Route: /accounts — account tabs + TransactionList
    CreditCardsPage.tsx            # Route: /credit-cards — card tabs + CreditCardTransactionList
  hooks/
    useTransactions.ts             # Upgrade from useQuery to useInfiniteQuery
    useCreditCardTransactions.ts   # New: useInfiniteQuery for credit card transactions
    useAccounts.ts                 # New: useQuery for account list (not paginated)
    useCreditCards.ts              # New: useQuery for card list (not paginated)
    useDebounced.ts                # New: debounce utility hook
```

### Pattern 1: useInfiniteQuery with Cursor Pagination

**What:** Replace the POC `useQuery` in `useTransactions.ts` with `useInfiniteQuery`. Flatten `pages[].data` arrays for render.

**When to use:** Any list that the MSW handler returns with `nextCursor`.

```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries
import { useInfiniteQuery } from '@tanstack/react-query'
import { useFilterParams } from '@/stores/filterStore'
import { getTransactions } from '@/services/accounts'

export function useTransactions() {
  const { accountId, dateFrom, dateTo, searchQuery, txType } = useFilterParams()

  return useInfiniteQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType }],
    queryFn: ({ pageParam }) => {
      if (!accountId) return Promise.resolve({ data: [], nextCursor: null, total: 0 })
      return getTransactions(accountId, pageParam as string | undefined)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accountId),
  })
}

// In component — flatten pages:
const allTransactions = data?.pages.flatMap((page) => page.data) ?? []
```

**Critical:** `getNextPageParam` must return `undefined` (not `null`) to signal no next page — TanStack Query v5 uses `undefined` as "no more pages" sentinel.

### Pattern 2: Loading / Error / Empty State Trifecta

**What:** Every data-fetching component must handle all three async states before rendering data. This satisfies DASH-03.

```typescript
// Applied in TransactionList.tsx
function TransactionList() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useTransactions()

  if (isLoading) return <TransactionListSkeleton />

  if (isError) return (
    <div className="p-6 text-center text-destructive">
      <p>Không thể tải giao dịch. Vui lòng thử lại.</p>
    </div>
  )

  const allTransactions = data?.pages.flatMap((p) => p.data) ?? []

  if (allTransactions.length === 0) return (
    <div className="p-6 text-center text-muted-foreground">
      <p>Không có giao dịch nào phù hợp.</p>
    </div>
  )

  return (
    <>
      {allTransactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
        </button>
      )}
    </>
  )
}
```

### Pattern 3: Skeleton Loading Rows

**What:** Use shadcn Skeleton to render N placeholder rows that match the shape of real TransactionRow.

```typescript
// Source: https://ui.shadcn.com/docs/components/radix/skeleton
import { Skeleton } from '@/components/ui/skeleton'

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between items-center border rounded p-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
```

### Pattern 4: Date Range Picker (Calendar + Popover)

**What:** Compose shadcn Calendar (mode="range") inside a Popover, wire to `useFilterStore.setDateRange`.

```typescript
// Source: https://ui.shadcn.com/docs/components/radix/date-picker
import { useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { useFilterStore } from '@/stores/filterStore'

export function DateRangePicker() {
  const setDateRange = useFilterStore((s) => s.setDateRange)
  const dateFrom = useFilterStore((s) => s.dateFrom)
  const dateTo = useFilterStore((s) => s.dateTo)

  const [selected, setSelected] = useState<DateRange | undefined>({
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  })

  function handleSelect(range: DateRange | undefined) {
    setSelected(range)
    setDateRange(
      range?.from ? format(range.from, 'yyyy-MM-dd') : null,
      range?.to ? format(range.to, 'yyyy-MM-dd') : null,
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected?.from
            ? selected.to
              ? `${format(selected.from, 'dd/MM/yyyy')} – ${format(selected.to, 'dd/MM/yyyy')}`
              : format(selected.from, 'dd/MM/yyyy')
            : 'Chọn khoảng ngày'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          locale={vi}
          disabled={(d) => d > new Date()}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
```

**Note:** `vi` locale from `date-fns/locale` localises month/day names in the calendar popup. Calendar labels will appear in Vietnamese automatically.

### Pattern 5: Debounced Search Input

**What:** Local input state updates immediately (responsive UI); debounced value triggers Zustand store update (which triggers query refetch).

```typescript
// useDebounced.ts — no npm dependency needed
import { useState, useEffect } from 'react'

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

// SearchInput.tsx
export function SearchInput() {
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery)
  const [local, setLocal] = useState('')
  const debounced = useDebounced(local, 350)

  useEffect(() => {
    setSearchQuery(debounced)
  }, [debounced, setSearchQuery])

  return (
    <Input
      placeholder="Tìm theo tên hoặc mô tả..."
      value={local}
      onChange={(e) => setLocal(e.target.value)}
    />
  )
}
```

**350ms delay** is the standard for text search — fast enough to feel responsive, slow enough to not fire on every keystroke.

### Pattern 6: Account Tabs (BANK-03)

**What:** shadcn Tabs drives account switching. Tab value is the accountId. On tab change, call `useFilterStore.setAccountId`.

```typescript
// Source: https://ui.shadcn.com/docs/components/radix/tabs
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useFilterStore } from '@/stores/filterStore'

export function AccountTabs({ accounts }: { accounts: BankAccount[] }) {
  const accountId = useFilterStore((s) => s.accountId)
  const setAccountId = useFilterStore((s) => s.setAccountId)

  return (
    <Tabs value={accountId ?? accounts[0]?.id} onValueChange={setAccountId}>
      <TabsList>
        {accounts.map((acc) => (
          <TabsTrigger key={acc.id} value={acc.id}>
            {acc.bankName} {acc.accountNumber}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Content is rendered by TransactionList which reads accountId from store */}
    </Tabs>
  )
}
```

### Pattern 7: React Router v7 Page Routing

**What:** Replace the flat App.tsx with Routes using `<Outlet />` for shared layout.

```typescript
// App.tsx — add Routes
import { Routes, Route } from 'react-router-dom'
import { BankAccountsPage } from '@/pages/BankAccountsPage'
import { CreditCardsPage } from '@/pages/CreditCardsPage'

// Inside BrowserRouter (already there):
<Routes>
  <Route path="/" element={<BankAccountsPage />} />
  <Route path="/accounts" element={<BankAccountsPage />} />
  <Route path="/credit-cards" element={<CreditCardsPage />} />
</Routes>
```

Navigation between pages via `<NavLink>` in the shared header. No nested route outlets needed in Phase 2 — pages are self-contained.

### Pattern 8: MSW Handler Enhancement for Server-Side Filtering

**What:** The current MSW handlers ignore `searchQuery`, `dateFrom`, `dateTo`, `txType` query params. They need to filter `mockTransactions` before paginating.

```typescript
// handlers.ts — enhanced account transactions handler
http.get('/api/accounts/:accountId/transactions', ({ params, request }) => {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Number(url.searchParams.get('limit') ?? '20')
  const search = url.searchParams.get('search') ?? ''
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')
  const txType = url.searchParams.get('txType') ?? 'all'
  const accountId = params.accountId as string

  let allTx = mockTransactions.filter((tx) => tx.accountId === accountId)

  // Apply filters
  if (search) {
    const q = search.toLowerCase()
    allTx = allTx.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        (tx.merchantName?.toLowerCase().includes(q) ?? false)
    )
  }
  if (dateFrom) allTx = allTx.filter((tx) => tx.transactionDate >= dateFrom)
  if (dateTo) allTx = allTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')
  if (txType !== 'all') allTx = allTx.filter((tx) => tx.type === txType)

  // Cursor pagination on filtered result
  const startIndex = cursor
    ? allTx.findIndex((tx) => tx.id === cursor) + 1
    : 0
  const page = allTx.slice(startIndex, startIndex + limit)
  const nextCursor =
    startIndex + limit < allTx.length ? (page[page.length - 1]?.id ?? null) : null

  return HttpResponse.json({ data: page, nextCursor, total: allTx.length })
}),
```

**IMPORTANT:** The service function `getTransactions` must also pass these filter params to the API call, and the query key in `useTransactions` already includes them. The service layer needs updating to forward filter params.

### Anti-Patterns to Avoid

- **Storing fetched data in Zustand:** TanStack Query is the server state owner. Zustand holds only filter/UI state. Never copy `data` from useInfiniteQuery into the filter store.
- **Calling `setSearchQuery` on every keystroke:** Always debounce search input before calling the store action. Each store update triggers a query refetch.
- **Using `new Date()` for date display:** Always use `toVietnamDate()` from `@/utils/dates` — the utility already handles UTC+7 conversion correctly.
- **Putting query params in MSW path pattern:** MSW docs explicitly say do not include query params in the path predicate. Read them from `new URL(request.url).searchParams` inside the resolver (already done correctly in existing handlers).
- **Using `useQuery` for paginated lists:** Once the list has `nextCursor` in the API response, `useInfiniteQuery` is the correct abstraction. Merging pages manually with `useQuery` causes stale cursor bugs on refetch.
- **`"use client"` directive:** This is a Next.js concept. This project uses plain Vite — never add `"use client"` to files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-page data fetching | Custom pages state + manual array merge | `useInfiniteQuery` | Handles refetch-all-pages, cursor tracking, race conditions automatically |
| Debounce | `setTimeout` stored in `useRef` directly in component | `useDebounced` hook (tiny, local) | Avoids leaked timers, encapsulates concern cleanly |
| Loading placeholder | Spinner or text | shadcn `Skeleton` | Maintains layout dimensions, no content jump, built-in pulse animation |
| Status badge | Custom `<span>` with conditional classNames | shadcn `Badge` | Consistent styling, accessible, variant-based |
| Date range input | Custom date input fields | shadcn `Calendar` + `Popover` | Built on React DayPicker, keyboard navigable, range mode supported |
| Vietnamese calendar locale | Manual month name translation | `vi` from `date-fns/locale` | Already locale-correct, works with Calendar locale prop |
| Filter state | `useState` inside page components | Zustand `useFilterStore` | Already wired to query keys — filter changes auto-trigger refetch |

**Key insight:** The MSW cursor pagination, Zustand filter store, service layer, and TanStack Query configuration are all already built. Phase 2 is almost entirely component assembly — the data plumbing is done.

---

## Common Pitfalls

### Pitfall 1: `getNextPageParam` returning `null` instead of `undefined`

**What goes wrong:** `useInfiniteQuery` treats `undefined` as "no more pages" but `null` as a valid cursor. If `getNextPageParam` returns `null` when there's no next page, `hasNextPage` stays `true` and infinite fetching begins.

**Why it happens:** The API response uses `nextCursor: null` to signal end-of-list. Developers pass that directly to `getNextPageParam`.

**How to avoid:**
```typescript
getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
// The ?? undefined converts null → undefined
```

**Warning signs:** "Load More" button never disables; network tab shows repeated requests with `cursor=null`.

### Pitfall 2: Filter Changes Reset Pagination Mid-Browse

**What goes wrong:** User scrolls to page 3 of transactions, then changes a filter. The query key changes, TanStack Query discards pages 1-3, but the component tries to render the old page count.

**Why it happens:** `useInfiniteQuery` with a changed `queryKey` starts fresh at page 1 — this is correct behavior. The issue is if the component stores `pageCount` in local state.

**How to avoid:** Never store pagination state locally. Let `useInfiniteQuery` manage it entirely. Render `data?.pages.flatMap(p => p.data) ?? []` — this correctly shows only what's been fetched for the current filter state.

### Pitfall 3: MSW Filter Not Applied → Filters Appear Broken

**What goes wrong:** User types in search box, query key changes, request fires with `?search=abc`, but MSW handler ignores the param and returns all transactions — filters appear to do nothing.

**Why it happens:** The current handlers only read `cursor` and `limit`. They don't read `search`, `dateFrom`, `dateTo`, or `txType`.

**How to avoid:** Update MSW handlers (Pattern 8 above) before building filter UI. Test the search filter works via browser devtools Network tab before wiring the UI.

### Pitfall 4: `useFilterParams` Selector Not Using `useShallow`

**What goes wrong:** Every render creates a new object reference even when values are unchanged, triggering infinite re-renders.

**Why it happens:** Zustand's default selector equality check uses reference equality. Object selectors always create new references.

**How to avoid:** Always use the existing `useFilterParams()` hook (which already wraps `useShallow`) when reading multiple filter values. For single values, bare selectors are fine: `useFilterStore((s) => s.accountId)`.

### Pitfall 5: Date Comparison Bug in MSW Date Filter

**What goes wrong:** Date filter by `dateTo` excludes transactions on the `dateTo` day itself because ISO strings like `2026-02-15T08:00:00Z` don't compare less-than `2026-02-15`.

**Why it happens:** String comparison of ISO dates works correctly only when the time part is also considered. `"2026-02-15T08:00:00Z" <= "2026-02-15"` is false.

**How to avoid:** Append `T23:59:59Z` to the `dateTo` string when filtering:
```typescript
if (dateTo) allTx = allTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')
```

### Pitfall 6: Calendar Locale Import Path

**What goes wrong:** `import { vi } from 'date-fns/locale'` fails in some bundler configurations; TypeScript complains about the module.

**Why it happens:** date-fns v4 changed locale import paths. Both `date-fns/locale` and `date-fns/locale/vi` work, but the barrel import is preferred.

**How to avoid:** Use:
```typescript
import { vi } from 'date-fns/locale'  // correct for date-fns v4
```

---

## Code Examples

### Service Layer: Forward Filter Params to API

The existing `getTransactions` function needs to accept and forward filter params:

```typescript
// services/accounts.ts — update signature
export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20,
  filters?: {
    search?: string
    dateFrom?: string | null
    dateTo?: string | null
    txType?: string
  }
) {
  const response = await apiClient.get(
    `/accounts/${accountId}/transactions`,
    {
      params: {
        ...(cursor && { cursor }),
        limit,
        ...(filters?.search && { search: filters.search }),
        ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters?.dateTo && { dateTo: filters.dateTo }),
        ...(filters?.txType && filters.txType !== 'all' && { txType: filters.txType }),
      }
    }
  )
  return PaginatedTransactionSchema.parse(response.data)
}
```

### Transaction Row: Amount Coloring Convention

Follow the pattern established in the POC TransactionList in App.tsx (positive = green, negative/expense = red):

```typescript
// TransactionRow.tsx
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import type { Transaction } from '@/types/account'

export function TransactionRow({ transaction: tx }: { transaction: Transaction }) {
  const isIncome = tx.type === 'income'
  return (
    <div className="flex justify-between items-center border rounded p-3">
      <div>
        <p className="font-medium">{tx.merchantName ?? tx.description}</p>
        <p className="text-sm text-muted-foreground">{formatDisplayDate(tx.transactionDate)}</p>
      </div>
      <span className={isIncome ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        {isIncome ? '+' : '–'}{formatVND(Math.abs(tx.amount))}
      </span>
    </div>
  )
}
```

### Credit Card Transaction Row: pending/posted Badge

```typescript
// CreditCardTransactionRow.tsx
import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dates'
import type { CreditCardTransaction } from '@/types/creditCard'

export function CreditCardTransactionRow({ transaction: tx }: { transaction: CreditCardTransaction }) {
  return (
    <div className="flex justify-between items-center border rounded p-3">
      <div>
        <p className="font-medium">{tx.merchantName}</p>
        <p className="text-sm text-muted-foreground">{formatDisplayDate(tx.transactionDate)}</p>
        <Badge variant={tx.status === 'pending' ? 'secondary' : 'default'}>
          {tx.status === 'pending' ? 'Chờ xử lý' : 'Đã hạch toán'}
        </Badge>
      </div>
      <span className="text-red-600 font-semibold">
        –{formatVND(Math.abs(tx.amount))}
      </span>
    </div>
  )
}
```

### Filter Bar Composition

```typescript
// FilterBar.tsx — composes all filter controls
import { DateRangePicker } from './DateRangePicker'
import { TransactionTypeFilter } from './TransactionTypeFilter'
import { SearchInput } from './SearchInput'
import { useFilterStore } from '@/stores/filterStore'
import { Button } from '@/components/ui/button'

export function FilterBar() {
  const resetFilters = useFilterStore((s) => s.resetFilters)

  return (
    <div className="flex flex-wrap gap-2 p-4 border-b">
      <SearchInput />
      <DateRangePicker />
      <TransactionTypeFilter />
      <Button variant="ghost" size="sm" onClick={resetFilters}>
        Xóa bộ lọc
      </Button>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `useQuery` + manual state for pagination | `useInfiniteQuery` with `initialPageParam` | Built-in page management, correct refetch behavior |
| Global CSS, custom components | shadcn/ui Radix-based, Tailwind v4 CSS-first | Already established in Phase 1 |
| `tailwind.config.js` | CSS-first `@theme` in `index.css` | No config file needed — already in place |
| `create<State>()(...)` double-curry Zustand v4 | Same pattern — still correct in Zustand v5 | No change needed |

**Deprecated/outdated in this project context:**
- The POC `TransactionList` component in `App.tsx` — replace with real components in Phase 2
- `useQuery` in `useTransactions.ts` — replace with `useInfiniteQuery`

---

## Open Questions

1. **Should filters be shared between Bank and Credit Card pages?**
   - What we know: `useFilterStore` has both `accountId` and `cardId`; `searchQuery`, `dateFrom`, `dateTo`, `txType` are shared.
   - What's unclear: If user filters by date range on the Bank page, should that date range persist when navigating to the Credit Cards page?
   - Recommendation: Yes — Zustand store persists across navigation by default (no reset on route change). This is desirable behavior. Only `setAccountId` vs `setCardId` is page-specific. Each page sets its own ID and ignores the other.

2. **How many months should the date range calendar show?**
   - What we know: `numberOfMonths={2}` is the standard pattern for date range pickers.
   - What's unclear: On mobile (375px — UX-01 requirement, Phase 4), two months is too wide.
   - Recommendation: Use `numberOfMonths={1}` for simplicity in Phase 2. Phase 4 can add responsive behavior.

3. **Should account tabs or a Select be used for account switching?**
   - What we know: There are exactly 2 bank accounts (VCB, TCB) and 2 credit cards (TCB Visa, VPBank) in fixtures.
   - What's unclear: What happens when real API returns more accounts.
   - Recommendation: Use Tabs for Phase 2 (2 accounts = perfect for tabs). Design with max 4 tabs in mind. Add overflow handling in Phase 4 if needed.

---

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 official docs: https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries — `useInfiniteQuery` API, `getNextPageParam`, `initialPageParam`, pages structure
- shadcn/ui official docs: https://ui.shadcn.com/docs/components/radix/date-picker — Date range picker with Calendar + Popover composition
- shadcn/ui official docs: https://ui.shadcn.com/docs/components/radix/skeleton — Skeleton installation and usage
- shadcn/ui official docs: https://ui.shadcn.com/docs/components/radix/tabs — Tabs controlled value pattern
- MSW official docs: https://mswjs.io/docs/http/intercepting-requests/query-parameters/ — query params pattern in handlers
- Project source files: `src/stores/filterStore.ts`, `src/hooks/useTransactions.ts`, `src/services/accounts.ts`, `src/types/*.ts`, `src/mocks/handlers.ts` — verified existing wiring

### Secondary (MEDIUM confidence)
- date-fns v4 + `vi` locale: https://github.com/shadcn-ui/ui/discussions/738 — confirmed `vi` from `date-fns/locale` works with Calendar locale prop
- React debounce pattern: https://medium.com/@markovsve/optimizing-react-performance-custom-debounce-hook-with-usecallback-8d841fee6615 — `useState` + `useEffect` debounce hook pattern

### Tertiary (LOW confidence — noted for awareness only)
- None. All critical claims verified with official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json confirmed, all versions verified
- Architecture patterns: HIGH — patterns derived from official TanStack Query and shadcn docs + existing Phase 1 code
- Pitfalls: HIGH — derived from actual code in the project (e.g., `useShallow` pattern already documented in filterStore.ts comments) and official TanStack Query v5 docs

**Research date:** 2026-03-03
**Valid until:** 2026-06-01 (TanStack Query and shadcn are stable; date-fns v4 locale import is stable)
