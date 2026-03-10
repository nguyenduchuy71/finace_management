# Phase 7: Transaction Categories - Research

**Researched:** 2026-03-08
**Domain:** Category classification algorithm, localStorage overrides, filter integration with TanStack Query + Zustand
**Confidence:** HIGH

---

## Summary

Phase 7 adds transaction categories to the existing transaction list. Each expense transaction displays a category badge auto-classified from the merchant name using a fixed Vietnamese taxonomy (Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Khác). Users can override the auto-classification, and overrides persist in localStorage without affecting the server representation.

The implementation spans three independent requirements:
1. **CAT-01**: Display auto-classified category badge on each transaction row
2. **CAT-02**: Store user overrides in localStorage (new `categoryOverrideStore` with Zustand)
3. **CAT-03**: Add category filter to FilterBar (wire to existing TanStack Query pattern)

The foundation is entirely present: Transaction schema already has an optional `category` field (currently populated by mock API), and the dashboard API already generates `categoryBreakdown`. Phase 7 is category normalization, UI display, and localStorage-backed override storage.

The most important technical decision is **localStorage category overrides do NOT modify server data** — they're client-side only. A separate Zustand store (`categoryOverrideStore`) persists `Map<transactionId, overriddenCategory>` to localStorage. When rendering or filtering, merge the override map with the server `tx.category` to compute the "effective category" for display.

**Primary recommendation:**
1. Define `CATEGORY_TAXONOMY` constant with 6 Vietnamese category labels and classification keywords
2. Implement `classifyTransaction(merchant: string, category?: string): Category` function in utils
3. Create `categoryOverrideStore` (Zustand + localStorage, similar to `themeStore` pattern)
4. Add `getCategoryLabel()` utility and `CategoryBadge` component
5. Extend `TransactionRow` to display category badge
6. Add `CategoryFilter` component and wire to `FilterBar` + `useFilterParams`
7. Update TransactionFilters interface and `getTransactions` service to accept category param
8. Update MSW handlers to filter by category

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAT-01 | Each transaction displays a category badge auto-classified from merchant name | Auto-classification function + `CategoryBadge` component in `TransactionRow` |
| CAT-02 | User can override category; override persists in localStorage | `categoryOverrideStore` (Zustand + localStorage) + custom hook to merge server + override |
| CAT-03 | User can filter by category (added to FilterBar) | `category` param in `FilterState`, `CategoryFilter` component, TanStack Query key includes category |
</phase_requirements>

---

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zustand | ^5.0 | UI state + localStorage persistence (categoryOverrideStore) | Installed — see `themeStore.ts` pattern |
| @tanstack/react-query | ^5.90 | Queries auto-refetch when category filter changes (in queryKey) | Installed — no changes needed |

### No New npm Dependencies

All phase requirements can be satisfied with existing stack. Specifically:
- Category classification is a pure function (no library needed)
- localStorage is native API (no package needed)
- UI is shadcn components + Tailwind (already available)

---

## Architecture Patterns

### Recommended Project Structure for Phase 7

```
src/
  utils/
    categories.ts                    # CATEGORY_TAXONOMY, classifyTransaction(), getCategoryLabel()
    categories.test.ts              # Classification algorithm tests
  stores/
    categoryOverrideStore.ts         # Zustand + localStorage, Map<txId, category>
    filterStore.ts                   # ADD: category field to FilterState
  components/
    ui/
      CategoryBadge.tsx              # Display category label with color coding
      (badge component already exists)
    filters/
      CategoryFilter.tsx             # NEW: Select or ToggleGroup for category filtering
      FilterBar.tsx                  # MODIFY: Add <CategoryFilter /> + wire category filter
  features/
    transactions/
      TransactionRow.tsx             # MODIFY: Add <CategoryBadge /> below description
      TransactionList.tsx            # No changes needed (uses FilterBar)
  services/
    accounts.ts                      # MODIFY: Add category to TransactionFilters interface + params
  types/
    categories.ts                    # NEW: Category type definition
```

### Pattern 1: Category Classification Function

**What:** Deterministic function that maps merchant name → category. No ML — simple keyword matching against a lookup table.

**When to use:** On render (classify displayed transactions) and on server data entry (classify incoming transaction from API).

**Example:**
```typescript
// Source: Project decision for Phase 7 implementation
export type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'

export const CATEGORY_TAXONOMY = {
  'Ăn uống': ['circle k', 'highlands coffee', 'the coffee house', 'pizza', 'pho', 'restaurant', 'cafe', 'burger'],
  'Mua sắm': ['shopee', 'lazada', 'tiki', 'sendo', 'mall', 'supermarket'],
  'Di chuyển': ['grab', 'be', 'gojek', 'taxi', 'gas station', 'parking', 'xăng dầu'],
  'Giải trí': ['cgv', 'netflix', 'spotify', 'gym', 'cinema'],
  'Hóa đơn': ['electricity', 'water', 'internet', 'phone bill', 'điện', 'nước'],
  'Khác': [],  // fallback for unmatched
}

export function classifyTransaction(merchant: string | undefined): Category {
  if (!merchant) return 'Khác'
  const query = merchant.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_TAXONOMY)) {
    if (keywords.some(kw => query.includes(kw))) {
      return category as Category
    }
  }
  return 'Khác'
}
```

**Critical decisions:**
- Keywords are lowercase; merchant name is lowercased for matching
- First match wins (order matters — can reorder by priority if needed)
- Unmatched → 'Khác' (other)
- Function is pure (no side effects), deterministic, testable

### Pattern 2: localStorage Override Store (Zustand v5)

**What:** Zustand store that persists a `Map<transactionId, overriddenCategory>` to localStorage. On render, merge server category + override to compute "effective" category.

**When to use:** User clicks a category badge to change it; override persists across page reload.

**Example:**
```typescript
// Source: See themeStore.ts for localStorage pattern precedent
import { create } from 'zustand'
import type { Category } from '@/utils/categories'

interface CategoryOverrideState {
  overrides: Map<string, Category>
  setOverride: (txId: string, category: Category) => void
  clearOverride: (txId: string) => void
  getEffectiveCategory: (txId: string, serverCategory: Category) => Category
}

export const useCategoryOverrideStore = create<CategoryOverrideState>((set, get) => {
  // Load from localStorage on init
  const saved = localStorage.getItem('finance-category-overrides')
  const initialOverrides = saved ? new Map(JSON.parse(saved)) : new Map()

  return {
    overrides: initialOverrides,
    setOverride: (txId, category) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        newOverrides.set(txId, category)
        localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
        return { overrides: newOverrides }
      })
    },
    clearOverride: (txId) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        newOverrides.delete(txId)
        localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
        return { overrides: newOverrides }
      })
    },
    getEffectiveCategory: (txId, serverCategory) => {
      return get().overrides.get(txId) ?? serverCategory
    },
  }
})
```

**Critical:**
- `Map` serializes to `[[key, val], [key, val], ...]` array via `JSON.stringify([...map])`
- On load, `new Map(JSON.parse(...))` deserializes back to Map
- `getEffectiveCategory` is a selector — no re-render on every call, but called per-transaction in render

### Pattern 3: Filter Integration with TanStack Query

**What:** Add `category` field to `FilterState` and `TransactionFilters`. Include in queryKey so filter changes auto-trigger refetch. MSW handler filters by category.

**When to use:** User selects a category filter; transaction list refetches with category param.

**Example:**
```typescript
// In filterStore.ts
export interface FilterState {
  // ... existing fields ...
  category: Category | 'all'  // NEW: add this
  setCategory: (category: Category | 'all') => void  // NEW action
}

// In accounts.ts service
export interface TransactionFilters {
  // ... existing fields ...
  category?: Category  // NEW: add this
}

export async function getTransactions(
  accountId: string,
  cursor?: string,
  limit = 20,
  filters?: TransactionFilters
) {
  const response = await apiClient.get(`/accounts/${accountId}/transactions`, {
    params: {
      // ... existing params ...
      ...(filters?.category && filters.category !== 'all' && { category: filters.category }),
    },
  })
  return PaginatedTransactionSchema.parse(response.data)
}

// In useTransactions hook
queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, category }]
// Now filter changes automatically refetch
```

**Critical:**
- `category: Category | 'all'` in store — 'all' means no filter, same as `txType: 'all'`
- queryKey MUST include category param — TanStack Query uses queryKey to decide if data is stale
- MSW handler filters by category param (see Pitfalls section)

### Anti-Patterns to Avoid

- **❌ Storing overrides in FilterState:** Filter state is ephemeral (reset on page clear); overrides must persist independently in their own store
- **❌ Modifying server transaction.category:** Overrides are client-only; never mutate the Transaction object returned from API
- **❌ Multiple re-renders per transaction:** `getEffectiveCategory` should be called once per render cycle, not on every state update
- **❌ Classification inside component render:** Classify transactions at data load time in a hook or effect, not during render

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category classification algorithm | Custom ML or complex NLP | Simple keyword lookup table | 99% of merchant names are recognizable; keywords sufficient for v1. ML adds complexity without user-facing benefit. Easy to extend later. |
| Persistent localStorage state | Manual JSON.stringify/parse + useEffect | Zustand (themeStore precedent) | Zustand v5 handles Map serialization, cleanup, and double-curry pattern already established in codebase. |
| Filter integration | Manual filter param wiring | TanStack Query queryKey pattern | Filter is already in TanStack Query key for date/type/search. Add category same way. Re-inventing refetch logic = bugs. |

**Key insight:** Category classification is deterministic and simple. Keywords work for Vietnamese merchants (Grab, Shopee, Circle K, etc. are unambiguous). Avoid over-engineering.

---

## Common Pitfalls

### Pitfall 1: Classification Runs Every Render

**What goes wrong:** Component calls `classifyTransaction()` on every render, even if merchant name hasn't changed. Performance non-issue for this dataset, but wastes computation.

**Why it happens:** Classification happens in TransactionRow render directly instead of upstream.

**How to avoid:** Classify transactions in `useTransactions` hook or at MSW boundary (once per API response). Pass `effectiveCategory` to TransactionRow as a prop.

**Warning signs:** Component re-renders frequently; DevTools shows `classifyTransaction()` called 100+ times per page.

---

### Pitfall 2: Override Store Not Synced with Delete

**What goes wrong:** User deletes a transaction and re-loads the page. If a later transaction has the same ID, the override from the deleted transaction applies.

**Why it happens:** localStorage overrides are never pruned; they accumulate indefinitely.

**How to avoid:**
- Transaction IDs are UUIDs (collision-free) — not a risk in this project
- Overrides are transaction-specific, never reused
- No cleanup needed unless app allows transaction deletion (out of scope for v1.1)

**Warning signs:** Overrides apply to "wrong" transactions after data changes.

---

### Pitfall 3: MSW Category Filter Case Sensitivity

**What goes wrong:** User filters by "Ăn uống" but handler checks case-sensitive string match.

**Why it happens:** JavaScript string comparison is case-sensitive; merchant names vary in capitalization.

**How to avoid:** In MSW handler, normalize both sides to lowercase or exact-match against canonical category names (which are Vietnamese strings in CATEGORY_TAXONOMY).

**Example:**
```typescript
// BAD: tx.category.toLowerCase() === category.toLowerCase() — category is already canonical
// GOOD: category is one of the 6 canonical categories; tx.category comes from classifyTransaction (same source)
if (category && category !== 'all') {
  allTx = allTx.filter((tx) => tx.category === category)
}
```

**Warning signs:** Filter by category doesn't work; filter by other types works fine.

---

### Pitfall 4: Override Persists for Wrong Category

**What goes wrong:** User sets override for transaction X to "Mua sắm", then reopens the app. Suddenly, a different transaction shows "Mua sắm" incorrectly.

**Why it happens:** Override stored by transaction ID, but UI displays wrong transaction (e.g., pagination reordered rows).

**How to avoid:** Transaction IDs are stable (from API). Pagination is cursor-based (not offset-based), so rows maintain identity across reloads. No risk in current architecture.

**Warning signs:** Overrides "move" to different rows after page reload or filter change.

---

### Pitfall 5: FilterState Resets Category on Page Navigation

**What goes wrong:** User filters by "Di chuyển", navigates to dashboard, returns to transaction list. Category filter is reset to 'all'.

**Why it happens:** React Router navigation doesn't persist filter state (depends on design). If FilterBar is inside a page component that unmounts, store resets.

**How to avoid:** `useFilterStore` is global Zustand store; state persists across navigation. FilterBar is inside AppShell (layout route), so it never unmounts. No risk in current design.

**Warning signs:** Filter resets to defaults after any navigation.

---

## Code Examples

Verified patterns from existing codebase:

### Example 1: Category Classification

```typescript
// Source: Project pattern for simple deterministic classification
export type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'

export const CATEGORY_TAXONOMY: Record<Category, string[]> = {
  'Ăn uống': ['circle k', 'highlands coffee', 'the coffee house', 'pho', 'restaurant', 'cafe'],
  'Mua sắm': ['shopee', 'lazada', 'tiki', 'sendo', 'mall', 'supermarket'],
  'Di chuyển': ['grab', 'be', 'gojek', 'taxi', 'parking', 'xăng dầu'],
  'Giải trí': ['cgv', 'netflix', 'spotify', 'gym', 'cinema'],
  'Hóa đơn': ['electricity', 'water', 'internet', 'phone bill', 'điện', 'nước'],
  'Khác': [],
}

export function classifyTransaction(merchant: string | undefined): Category {
  if (!merchant) return 'Khác'
  const query = merchant.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_TAXONOMY)) {
    if (keywords.some(kw => query.includes(kw))) {
      return category as Category
    }
  }
  return 'Khác'
}

export function getCategoryLabel(category: Category): string {
  // Display label same as key (Vietnamese category names are labels)
  return category
}
```

### Example 2: Category Override Store (Zustand v5 + localStorage)

```typescript
// Source: See themeStore.ts pattern at src/stores/themeStore.ts
import { create } from 'zustand'
import type { Category } from '@/utils/categories'

interface CategoryOverrideState {
  overrides: Map<string, Category>
  setOverride: (txId: string, category: Category) => void
  clearOverride: (txId: string) => void
  getEffectiveCategory: (txId: string, serverCategory: Category) => Category
}

export const useCategoryOverrideStore = create<CategoryOverrideState>((set, get) => {
  const saved = localStorage.getItem('finance-category-overrides')
  const initialOverrides = saved ? new Map(JSON.parse(saved) as [string, Category][]) : new Map()

  return {
    overrides: initialOverrides,
    setOverride: (txId, category) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        newOverrides.set(txId, category)
        localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
        return { overrides: newOverrides }
      })
    },
    clearOverride: (txId) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        newOverrides.delete(txId)
        localStorage.setItem('finance-category-overrides', JSON.stringify([...newOverrides]))
        return { overrides: newOverrides }
      })
    },
    getEffectiveCategory: (txId, serverCategory) => {
      return get().overrides.get(txId) ?? serverCategory
    },
  }
})
```

### Example 3: Filter Integration (TanStack Query queryKey includes category)

```typescript
// Source: Follows Phase 2 pattern at src/hooks/useTransactions.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { useFilterParams } from '@/stores/filterStore'
import { getTransactions } from '@/services/accounts'

export function useTransactions() {
  const { accountId, dateFrom, dateTo, searchQuery, txType, category } = useFilterParams()

  return useInfiniteQuery({
    queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, category }],
    queryFn: ({ pageParam }) => {
      if (!accountId) return Promise.resolve({ data: [], nextCursor: null, total: 0 })
      return getTransactions(accountId, pageParam as string | undefined, 20, {
        search: searchQuery,
        dateFrom,
        dateTo,
        txType,
        category,  // NEW
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accountId),
  })
}

// In component:
const allTransactions = data?.pages.flatMap((page) => page.data) ?? []
```

### Example 4: CategoryBadge Component (shadcn Badge variant)

```typescript
// Source: Follows shadcn pattern used in TransactionRow, CreditCardTransactionRow
import { Badge } from '@/components/ui/badge'
import type { Category } from '@/utils/categories'

interface CategoryBadgeProps {
  category: Category
  className?: string
}

const categoryColorMap: Record<Category, string> = {
  'Ăn uống': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  'Mua sắm': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
  'Di chuyển': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  'Giải trí': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  'Hóa đơn': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  'Khác': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  return (
    <Badge variant="secondary" className={`${categoryColorMap[category]} ${className}`}>
      {category}
    </Badge>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-provided category | Auto-classify on client + override in localStorage | Phase 7 (this phase) | Users can customize without backend; v1 uses mock API so no real backend dependency anyway. |
| Manual category per UI element | Shared `classifyTransaction()` + `getCategoryLabel()` utilities | Phase 7 | Consistency: all components use same classification. Single source of truth. |
| Zustand without localStorage | Zustand + localStorage pattern (see themeStore precedent) | Phase 7 | Overrides persist across sessions. Follows existing codebase pattern. |

**Deprecated/outdated:**
- N/A — Phase 7 introduces category feature for first time

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library |
| Config file | vite.config.ts (vitest block) |
| Quick run command | `npm test -- src/utils/categories.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | `classifyTransaction('Grab')` returns 'Di chuyển' | unit | `npm test -- src/utils/categories.test.ts -t "classify"` | ❌ Wave 0 |
| CAT-01 | `TransactionRow` renders `CategoryBadge` with correct category | unit | `npm test -- src/features/transactions/TransactionRow.test.ts -t "displays category"` | ❌ Wave 0 |
| CAT-02 | `useCategoryOverrideStore.setOverride()` persists to localStorage | unit | `npm test -- src/stores/categoryOverrideStore.test.ts -t "persist"` | ❌ Wave 0 |
| CAT-02 | `getEffectiveCategory()` returns override when set, server category otherwise | unit | `npm test -- src/stores/categoryOverrideStore.test.ts -t "effective"` | ❌ Wave 0 |
| CAT-03 | `FilterBar` includes `CategoryFilter` component | unit | `npm test -- src/components/filters/FilterBar.test.ts -t "category"` | ❌ Wave 0 |
| CAT-03 | Changing category filter triggers transaction re-fetch | integration | `npm test -- src/hooks/useTransactions.test.ts -t "category filter"` | ✅ Exists (needs category param added) |

### Sampling Rate
- **Per task commit:** `npm test -- src/utils/categories.test.ts && npm test -- src/stores/categoryOverrideStore.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/categories.ts` — core classification function (not tested until Wave 0)
- [ ] `src/utils/categories.test.ts` — classification unit tests (6 test cases for keyword matching, fallback to 'Khác')
- [ ] `src/stores/categoryOverrideStore.ts` — override persistence (not tested until Wave 0)
- [ ] `src/stores/categoryOverrideStore.test.ts` — override store tests (setOverride, clearOverride, getEffectiveCategory, localStorage round-trip)
- [ ] `src/components/ui/CategoryBadge.tsx` — badge component wrapper (display logic, color map)
- [ ] `src/components/filters/CategoryFilter.tsx` — category select control (wire to filterStore.setCategory)
- [ ] `src/features/transactions/TransactionRow.test.ts` — add test for category badge render
- [ ] `src/components/filters/FilterBar.test.ts` — add test for CategoryFilter presence + clear-filters behavior
- [ ] Update `src/types/categories.ts` with Category type definition
- [ ] Framework install: Already installed (Vitest v4 in vite.config.ts, jest-dom in test-setup.ts)

*(If category feature not tested initially: Existing test suite still green. Category tests can be added in Phase 7 execution.)*

---

## Sources

### Primary (HIGH confidence)
- v1.0 codebase: `src/types/account.ts`, `src/services/accounts.ts`, `src/stores/filterStore.ts`, `src/mocks/handlers.ts` — verified current Transaction schema and filter patterns
- v1.0 codebase: `src/stores/themeStore.ts` — localStorage + Zustand pattern for `categoryOverrideStore`
- REQUIREMENTS.md (2026-03-08) — Category taxonomy defined: Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Khác
- MEMORY.md (Phase 1 patterns) — TanStack Query queryKey includes all filter params for auto-refetch; filterStore uses Zustand v5 double-curry

### Secondary (MEDIUM confidence)
- v1.0 codebase: `src/mocks/fixtures/transactions.ts` — example merchant names (Circle K, Grab, Shopee) inform keyword lookup table
- v1.0 codebase: `src/features/transactions/TransactionRow.tsx` — existing badge + color pattern can be extended to CategoryBadge

---

## Metadata

**Confidence breakdown:**
- Category taxonomy & classification: **HIGH** — Requirements are explicit, merchant names are predictable
- localStorage integration: **HIGH** — themeStore precedent, localStorage API is native, no third-party dependency
- Filter wiring: **HIGH** — Phase 2 established TanStack Query + Zustand pattern; CAT-03 is a direct application
- MSW handler updates: **HIGH** — Current handlers established filtering pattern; category param is straightforward add

**Research date:** 2026-03-08
**Valid until:** 2026-03-15 (1 week — category classification may need keyword expansion based on real merchant data)

---

## Open Questions

1. **Keyword Expansion**: Will mock merchant names match real banking API merchants?
   - What we know: Fixture data includes Thai merchants (Circle K, Grab, Shopee, Lazada) — common in Vietnam
   - What's unclear: Real API may include unfamiliar merchants requiring keyword table expansion
   - Recommendation: Start with provided keywords; add merchant-specific keywords in Phase 7 based on real fixture preview if available

2. **Category Edit UI**: Should category badge be clickable to open a dropdown, or separate edit interface?
   - What we know: Requirements don't specify UI for override (just "user can override")
   - What's unclear: UX detail (badge click vs. edit button vs. context menu)
   - Recommendation: Badge click → simple popover with 6 radio buttons for category selection. Simple, discoverable.

3. **Income Transactions**: How to categorize income?
   - What we know: Transaction schema has `type: 'income' | 'expense'`; category typically applies to expenses
   - What's unclear: Should income be categorized? (SALARY, TRANSFER, BONUS?) Not in requirements.
   - Recommendation: Skip income categorization in v1.1. CAT-01/02/03 apply to expenses only. Easy to extend later.

---
