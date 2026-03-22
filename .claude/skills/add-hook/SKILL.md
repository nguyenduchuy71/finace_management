---
name: add-hook
description: >
  Create or modify TanStack Query hooks for the FinanceManager project.
  Use this skill when the user wants to add a new data-fetching hook, modify an existing hook's
  query parameters, add infinite scroll pagination, or integrate Zustand filter state into a hook.
  Covers useQuery, useInfiniteQuery, useQueries, and proper queryKey composition.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# Add Hook Skill — FinanceManager

## Overview

Hooks in this project wrap TanStack Query v5 and read filter state from Zustand stores.
Always read existing hooks before creating new ones to follow established patterns.

## QueryClient Config (from App.tsx)

```ts
{
  staleTime: 5 * 60 * 1000,      // 5 min — don't refetch if data fresh
  gcTime: 10 * 60 * 1000,        // 10 min — keep in cache after unmount
  retry: 2,
  refetchOnWindowFocus: false,
}
```

## Existing Hooks Reference

Before writing a new hook, read the most relevant existing hook:
- `src/hooks/useAccounts.ts` — simple `useQuery` pattern
- `src/hooks/useTransactions.ts` — `useInfiniteQuery` with filters from `filterStore`
- `src/hooks/useDashboardStats.ts` — `useQueries` for parallel fetching (current + prev month)
- `src/hooks/useBudgetAlerts.ts` — derived state + side effects (Sonner toasts)

## Pattern 1 — Simple Query

```ts
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@/services/accounts'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  })
}
```

## Pattern 2 — Query with Filters from Zustand Store

```ts
import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useFilterStore } from '@/stores/filterStore'
import { getTransactions } from '@/services/accounts'

export function useTransactions() {
  // ALWAYS use useShallow for multi-field selectors (Zustand v5)
  const { accountId, dateFrom, dateTo, searchQuery, txType, category } =
    useFilterStore(useShallow(s => ({
      accountId: s.accountId,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      searchQuery: s.searchQuery,
      txType: s.txType,
      category: s.category,
    })))

  return useQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, category }],
    // ^^^ ALL filter params must be in queryKey — auto-refetches on filter change
    queryFn: () => getTransactions(accountId, { dateFrom, dateTo, searchQuery, txType, category }),
    enabled: !!accountId,   // Only fetch when accountId is set
  })
}
```

## Pattern 3 — Infinite Query (Cursor Pagination)

```ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

export function useTransactions() {
  const filters = useFilterStore(useShallow(s => ({
    accountId: s.accountId,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    searchQuery: s.searchQuery,
    txType: s.txType,
    category: s.category,
  })))

  return useInfiniteQuery({
    queryKey: ['transactions', filters.accountId, filters],
    queryFn: ({ pageParam }) =>
      getTransactions(filters.accountId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!filters.accountId,
  })
}

// In component — flatten pages:
const allTransactions = data?.pages.flatMap(p => p.data) ?? []
```

## Pattern 4 — Parallel Queries (useQueries)

```ts
import { useQueries } from '@tanstack/react-query'

export function useDashboardStats() {
  const { dateFrom, dateTo } = useDashboardStore(useShallow(...))
  const { prevFrom, prevTo } = getPreviousMonthDateRange(dateFrom, dateTo)

  const [current, previous] = useQueries({
    queries: [
      { queryKey: ['dashboard', 'stats', { dateFrom, dateTo }], queryFn: () => getDashboardStats({ dateFrom, dateTo }) },
      { queryKey: ['dashboard', 'stats', { dateFrom: prevFrom, dateTo: prevTo }], queryFn: () => getDashboardStats({ dateFrom: prevFrom, dateTo: prevTo }) },
    ],
  })

  return { current, previous }
}
```

## Pattern 5 — Derived Hook with Side Effects

```ts
import { useEffect } from 'react'
import { toast } from 'sonner'

export function useBudgetAlerts(breakdown: CategoryBreakdown[], budgets: BudgetState) {
  const alerts = useMemo(() => computeAlerts(breakdown, budgets), [breakdown, budgets])

  useEffect(() => {
    alerts.filter(a => a.severity === 'over').forEach(a => {
      toast.error(`Vượt ngân sách: ${a.category}`)
    })
  }, [alerts])

  return alerts
}
```

## Critical Rules for Hooks

1. **queryKey completeness** — Every filter param that affects the API response MUST be in queryKey
2. **`useShallow` always** — For any Zustand selector selecting 2+ fields
3. **`enabled` guard** — Use `enabled: !!requiredParam` to skip fetch when param missing
4. **No `any`** — Type all hook return values explicitly or use `ReturnType<typeof useQuery>`
5. **Service layer** — Hooks call service functions, never `apiClient` directly

## Sub-Agent Usage

When creating a hook for an unfamiliar feature:
1. Launch Explore sub-agent to read the relevant service file and existing similar hooks
2. Confirm the API response shape from `src/mocks/handlers.ts`
3. Write the hook with correct types inferred from Zod schemas
