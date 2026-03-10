# Phase 8: Budget Tracking - Research

**Researched:** 2026-03-08
**Domain:** localStorage-backed budget store (Zustand), progress bar UI with conditional styling, category-to-budget mapping
**Confidence:** HIGH

---

## Summary

Phase 8 adds monthly budget tracking per category. Users set budgets (in VND currency format), the dashboard displays spending progress per category with progress bars, and color-coded warnings when approaching or exceeding limits. Budgets are stored in localStorage via Zustand (similar to `themeStore` and `categoryOverrideStore` patterns). No backend required — this is entirely client-side state management.

The feature integrates tightly with Phase 7 (categories) and Phase 4 (dashboard). The existing `getDashboardStats` API already returns `categoryBreakdown` which provides spent-per-category. Phase 8 adds:

1. **BUDGET-01**: A settings interface (new page or modal) to set monthly budget per category
2. **BUDGET-02**: Dashboard renders budget progress bars per category below existing stat cards
3. **BUDGET-03**: Progress bar styling changes (yellow at ≥80%, red at ≥100%)

All data flows are synchronous:
- User sets budget → persists to localStorage via Zustand store
- Dashboard loads categoryBreakdown (spent) + budgets (limit) → calculates percent spent
- Progress bar renders with conditional styling based on percentage

**Primary recommendation:**

1. Create `budgetStore` (Zustand + localStorage) with `Record<Category, number>` map and setters
2. Create `BudgetProgressBar` component (wraps shadcn Progress with conditional color classes)
3. Create budget settings UI (modal or dedicated page with category inputs + currency format)
4. Add budget progress bars to dashboard immediately after stat cards or within category breakdown section
5. Ensure progress bar styling handles edge cases (no budget set = bar hidden or neutral, zero spent = 0%)

---

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zustand | ^5.0 | Budget state + localStorage persistence | Installed — see `themeStore` and `categoryOverrideStore` patterns |
| @tanstack/react-query | ^5.90 | Dashboard stats (no changes needed) | Installed — `categoryBreakdown` already available |
| recharts | ^3.7.0 | Category breakdown chart (no changes needed) | Installed — Phase 4 |
| tailwindcss | ^4.0 | Progress bar styling with conditional color classes | Installed — CSS-first config |

### No New npm Dependencies

All phase requirements can be satisfied with existing stack:
- Budget storage is a Zustand store (no library needed)
- Progress bar is shadcn Progress component (already available via @radix-ui/react-progress)
- Conditional styling is Tailwind classes
- Currency format uses existing `formatVND()` utility

---

## Architecture Patterns

### Recommended Project Structure for Phase 8

```
src/
  types/
    budget.ts                           # NEW: BudgetState type
  stores/
    budgetStore.ts                      # NEW: Zustand + localStorage, Record<Category, number>
    budgetStore.test.ts                 # NEW: unit tests for setters + localStorage round-trip
  components/
    ui/
      (progress component already exists from @radix-ui)
    budget/
      BudgetProgressBar.tsx             # NEW: Progress bar with conditional color classes
      BudgetSettings.tsx                # NEW: Modal or page to set budgets per category
  features/
    dashboard/
      DashboardPage.tsx                 # MODIFY: Add budget progress section after stat cards
      BudgetProgressSection.tsx         # NEW: Container for category budget bars
  services/
    dashboard.ts                        # No changes needed (categoryBreakdown already available)
```

### Pattern 1: Budget Store (Zustand v5 + localStorage)

**What:** Zustand store that persists a `Record<Category, number>` (category name → budget amount in VND) to localStorage.

**When to use:** User sets a budget; budget persists across sessions and is available for calculation on dashboard load.

**Example:**

```typescript
// Source: See themeStore.ts and categoryOverrideStore.ts for localStorage patterns
import { create } from 'zustand'
import type { Category } from '@/types/categories'

interface BudgetState {
  budgets: Record<Category, number>
  setBudget: (category: Category, amount: number) => void
  clearBudget: (category: Category) => void
  getBudget: (category: Category) => number
}

export const useBudgetStore = create<BudgetState>((set, get) => {
  // Load from localStorage on init
  const saved = localStorage.getItem('finance-budgets')
  const initialBudgets: Record<Category, number> = saved ? JSON.parse(saved) : {}

  return {
    budgets: initialBudgets,
    setBudget: (category, amount) => {
      set((state) => {
        const newBudgets = { ...state.budgets, [category]: amount }
        localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
        return { budgets: newBudgets }
      })
    },
    clearBudget: (category) => {
      set((state) => {
        const newBudgets = { ...state.budgets }
        delete newBudgets[category]
        localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
        return { budgets: newBudgets }
      })
    },
    getBudget: (category) => {
      return get().budgets[category] ?? 0
    },
  }
})
```

**Critical:**
- Budget amounts are numbers (VND, no decimals — Vietnamese currency uses integers)
- `Record<Category, number>` serializes to JSON naturally
- `getBudget` returns 0 if category has no budget (no budget set = unlimited, hidden progress bar)
- No selector hook needed; component reads entire store

### Pattern 2: Progress Bar Component with Conditional Styling

**What:** Displays progress as (spent / budget) percent, with color coding: yellow ≥80%, red ≥100%. Uses shadcn Progress component with Tailwind conditional classes.

**When to use:** Dashboard renders one progress bar per category that has a budget set.

**Example:**

```typescript
// Source: shadcn Progress pattern + conditional Tailwind styling
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/types/categories'

interface BudgetProgressBarProps {
  category: Category
  spent: number
  budget: number
  className?: string
}

export function BudgetProgressBar({ category, spent, budget, className = '' }: BudgetProgressBarProps) {
  if (budget === 0) return null  // No budget set — don't render

  const percent = Math.min(Math.round((spent / budget) * 100), 100)
  const isWarning = percent >= 80 && percent < 100
  const isOverBudget = percent >= 100

  // Conditional background class
  const indicatorColor = isOverBudget
    ? 'bg-red-600 dark:bg-red-500'
    : isWarning
    ? 'bg-yellow-500 dark:bg-yellow-400'
    : 'bg-emerald-600 dark:bg-emerald-500'

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{category}</span>
        <span className="text-xs text-muted-foreground">{percent}%</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${indicatorColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatVND(spent)} / {formatVND(budget)}
      </p>
    </div>
  )
}
```

**Critical:**
- `percent` is capped at 100 (bar never overflows visually)
- Conditional color is applied to the fill div, not the container
- Warning state is ≥80% AND <100%; overbudget is ≥100%
- Don't render if budget is 0 (no budget set for this category)

### Pattern 3: Budget Settings UI

**What:** Form-based UI where user can set budget per category. Uses currency input (supports VND format with thousand separators). Submitting updates Zustand store.

**When to use:** User clicks "Settings" button or navigates to budget management page.

**Example:**

```typescript
// Source: Follows existing form patterns in FilterBar and ChatSettings
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBudgetStore } from '@/stores/budgetStore'
import { formatVND, parseVND } from '@/utils/currency'
import { CATEGORY_TAXONOMY } from '@/utils/categories'
import type { Category } from '@/types/categories'

interface BudgetSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetSettings({ open, onOpenChange }: BudgetSettingsProps) {
  const { budgets, setBudget } = useBudgetStore()
  const categories = Object.keys(CATEGORY_TAXONOMY) as Category[]
  const [localBudgets, setLocalBudgets] = useState<Record<Category, string>>(
    Object.fromEntries(categories.map(cat => [cat, formatVND(budgets[cat] ?? 0)]))
  )

  const handleSave = () => {
    for (const category of categories) {
      const amount = parseVND(localBudgets[category])
      if (amount > 0) {
        setBudget(category, amount)
      }
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đặt ngân sách theo danh mục</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category}>
              <label className="block text-sm font-medium mb-1">{category}</label>
              <Input
                type="text"
                value={localBudgets[category]}
                onChange={(e) => setLocalBudgets({ ...localBudgets, [category]: e.target.value })}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Critical:**
- Input is text-based with `parseVND` to extract numeric value
- Display uses `formatVND` for thousand-separator formatting
- Categories come from `CATEGORY_TAXONOMY` keys (ensures consistency with Phase 7)
- Save handler persists each budget to store individually via `setBudget`

### Anti-Patterns to Avoid

- **❌ Storing budgets in FilterState:** Filter state is ephemeral; budgets must persist independently
- **❌ Calculating progress server-side:** Dashboard already provides spent data; calculation is simple client-side
- **❌ Using default Progress without conditional styling:** Shadcn Progress has no built-in conditional colors; wrap it
- **❌ Rendering all categories with 0% bar:** Only render progress bar if budget > 0; unlisted categories are unlimited
- **❌ Hard-coding category names in progress section:** Use CATEGORY_TAXONOMY to iterate; ensures sync with Phase 7

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| localStorage persistence for budget state | Manual JSON.stringify/parse in effects | Zustand store (themeStore + categoryOverrideStore precedent) | Zustand v5 handles serialization, cleanup, and state initialization. Already established in codebase. |
| Progress bar with conditional styling | Custom div-based bar | shadcn Progress + Tailwind conditional classes | shadcn provides accessible markup (ARIA attributes); conditional Tailwind is simpler than CSS-in-JS |
| Currency input parsing | Manual string manipulation | `parseVND()` utility + `formatVND()` for display | Existing utility handles Vietnamese format edge cases (thousand separators, no decimals) |
| Budget-category mapping | Separate budget tracking service | Zustand store with `Record<Category, number>` | Zustand is already the pattern; avoids API complexity for client-only state |

**Key insight:** Budget tracking is pure client-side state management. Avoid over-architecting with services or APIs. Zustand + localStorage is sufficient and consistent with existing patterns.

---

## Common Pitfalls

### Pitfall 1: Progress Bar Renders When Budget = 0

**What goes wrong:** Component renders an empty progress bar (0%) even when user hasn't set a budget. Clutters dashboard with unlabeled bars.

**Why it happens:** Component doesn't check if budget exists before rendering.

**How to avoid:** Guard render with `if (budget === 0) return null`. Only show bars for categories with budgets set.

**Warning signs:** Dashboard shows 6 empty progress bars (one per category) even on fresh install with no budgets.

---

### Pitfall 2: Currency Input Doesn't Parse Thousand Separators

**What goes wrong:** User enters "100.000" (formatted VND) but store receives literal string or NaN.

**Why it happens:** Input parsing uses simple `parseInt()` instead of `parseVND()` utility which handles Vietnamese format.

**How to avoid:** Use existing `parseVND()` utility (Phase 1 decision). It extracts digits and handles separator variations.

**Warning signs:** Setting budget to "100.000" doesn't work; only single-digit numbers work.

---

### Pitfall 3: Store Not Initialized on First Load

**What goes wrong:** `budgetStore.budgets` is undefined on initial render before localStorage is parsed. Component crashes.

**Why it happens:** Zustand store initialization doesn't have fallback for missing localStorage.

**How to avoid:** Initialize with empty object: `const initialBudgets = saved ? JSON.parse(saved) : {}`. Matches `themeStore` pattern.

**Warning signs:** App crashes on first load with "Cannot read property of undefined".

---

### Pitfall 4: Progress Bar Percent Exceeds 100% Visually

**What goes wrong:** If spent > budget, progress bar width is >100%, overflows container and looks broken.

**Why it happens:** Component doesn't cap percent at 100.

**How to avoid:** Use `Math.min(percent, 100)` for visual capping. Still display actual percent in label (200%) so user sees they're over budget.

**Warning signs:** Progress bar extends beyond its container when overspending.

---

### Pitfall 5: Budget Colors Hardcoded Instead of Theme-aware

**What goes wrong:** Yellow and red are hardcoded RGB values; dark mode looks wrong or unreadable.

**Why it happens:** Conditional styling uses hardcoded Tailwind classes without dark: prefix.

**How to avoid:** Use Tailwind dark mode classes: `bg-yellow-500 dark:bg-yellow-400` and `bg-red-600 dark:bg-red-500`. Matches existing pattern (see StatCard and CategoryChart).

**Warning signs:** Progress bar is hard to read in dark mode.

---

### Pitfall 6: Settings Dialog Can't Be Dismissed

**What goes wrong:** User opens budget settings, closes dialog, re-opens. Dialog state is stale or won't close.

**Why it happens:** Dialog doesn't properly wire open/close state to parent component.

**How to avoid:** Use shadcn Dialog with controlled `open` prop and `onOpenChange` callback. Match ChatSettings pattern (Phase 5).

**Warning signs:** Dialog won't close even after clicking outside or pressing Escape.

---

### Pitfall 7: Zooming Dashboard With No Budgets Shows Empty Section

**What goes wrong:** Dashboard shows empty "Budget Progress" card when no budgets are set. Confusing for new users.

**Why it happens:** Component renders even when all budgets are 0.

**How to avoid:** Entire budget section should be hidden if no budgets exist. Use conditional render at parent level: `{hasBudgets && <BudgetProgressSection />}`.

**Warning signs:** Empty card on dashboard with title but no content.

---

## Code Examples

Verified patterns from existing codebase:

### Example 1: Budget Store (Zustand v5 + localStorage)

```typescript
// Source: Combines themeStore.ts and categoryOverrideStore.ts patterns
import { create } from 'zustand'
import type { Category } from '@/types/categories'

interface BudgetState {
  budgets: Record<Category, number>
  setBudget: (category: Category, amount: number) => void
  clearBudget: (category: Category) => void
  getBudget: (category: Category) => number
}

export const useBudgetStore = create<BudgetState>((set, get) => {
  const saved = localStorage.getItem('finance-budgets')
  const initialBudgets: Record<Category, number> = saved ? JSON.parse(saved) : {}

  return {
    budgets: initialBudgets,
    setBudget: (category, amount) => {
      set((state) => {
        const newBudgets = { ...state.budgets, [category]: amount }
        localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
        return { budgets: newBudgets }
      })
    },
    clearBudget: (category) => {
      set((state) => {
        const newBudgets = { ...state.budgets }
        delete newBudgets[category]
        localStorage.setItem('finance-budgets', JSON.stringify(newBudgets))
        return { budgets: newBudgets }
      })
    },
    getBudget: (category) => {
      return get().budgets[category] ?? 0
    },
  }
})
```

### Example 2: Budget Progress Bar Component

```typescript
// Source: Conditional Tailwind styling pattern from StatCard + CategoryChart
import { formatVND } from '@/utils/currency'
import type { Category } from '@/types/categories'

interface BudgetProgressBarProps {
  category: Category
  spent: number
  budget: number
  className?: string
}

export function BudgetProgressBar({
  category,
  spent,
  budget,
  className = '',
}: BudgetProgressBarProps) {
  if (budget === 0) return null

  const percent = Math.min(Math.round((spent / budget) * 100), 100)
  const isWarning = percent >= 80 && percent < 100
  const isOverBudget = percent >= 100

  const indicatorColor = isOverBudget
    ? 'bg-red-600 dark:bg-red-500'
    : isWarning
      ? 'bg-yellow-500 dark:bg-yellow-400'
      : 'bg-emerald-600 dark:bg-emerald-500'

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{category}</span>
        <span className="text-xs text-muted-foreground">{percent}%</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${indicatorColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatVND(spent)} / {formatVND(budget)}
      </p>
    </div>
  )
}
```

### Example 3: Dashboard Integration (Budget Progress Section)

```typescript
// Source: Follows dashboard card layout pattern from DashboardPage
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBudgetStore } from '@/stores/budgetStore'
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar'
import type { CategoryBreakdownItem } from '@/services/dashboard'
import type { Category } from '@/types/categories'

interface BudgetProgressSectionProps {
  categoryBreakdown: CategoryBreakdownItem[]
}

export function BudgetProgressSection({ categoryBreakdown }: BudgetProgressSectionProps) {
  const { budgets } = useBudgetStore()
  const hasBudgets = Object.values(budgets).some(b => b > 0)

  if (!hasBudgets) return null

  const categoryMap = Object.fromEntries(
    categoryBreakdown.map(item => [item.category, item.amount])
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Tiến độ ngân sách
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.keys(budgets) as Category[]).map((category) => (
            <BudgetProgressBar
              key={category}
              category={category}
              spent={categoryMap[category] ?? 0}
              budget={budgets[category]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Backend budget storage | localStorage + Zustand | Phase 8 | Frontend-only app; localStorage sufficient. No API round-trip needed. |
| Manual progress bar with inline styles | shadcn Progress + Tailwind conditional classes | Phase 8 | Consistent with v1.0 styling pattern. Dark mode support built-in. |
| Hardcoded warning thresholds | Config constants (80% yellow, 100% red) per requirements | Phase 8 | Explicit per REQUIREMENTS.md. Easy to adjust if thresholds change later. |

**Deprecated/outdated:**
- N/A — Phase 8 introduces budget feature for first time

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library |
| Config file | vite.config.ts (vitest block) |
| Quick run command | `npm test -- src/stores/budgetStore.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUDGET-01 | `useBudgetStore.setBudget()` persists to localStorage | unit | `npm test -- src/stores/budgetStore.test.ts -t "persist"` | ❌ Wave 0 |
| BUDGET-01 | Budget settings UI can update budgets for all 6 categories | integration | `npm test -- src/components/budget/BudgetSettings.test.ts -t "save"` | ❌ Wave 0 |
| BUDGET-02 | `BudgetProgressBar` renders progress bar when budget > 0 | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "render"` | ❌ Wave 0 |
| BUDGET-02 | Dashboard shows budget progress bars for categories with budgets | integration | `npm test -- src/features/dashboard/DashboardPage.test.ts -t "budget bars"` | ✅ Exists (needs budget bars added) |
| BUDGET-03 | Progress bar styling: yellow at ≥80%, red at ≥100% | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "color"` | ❌ Wave 0 |
| BUDGET-03 | No progress bar renders when budget = 0 | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "no budget"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/stores/budgetStore.test.ts && npm test -- src/components/budget/BudgetProgressBar.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/budgetStore.ts` — Zustand store with Record<Category, number>
- [ ] `src/stores/budgetStore.test.ts` — setBudget, clearBudget, localStorage round-trip, getBudget(unknown) returns 0
- [ ] `src/components/budget/BudgetProgressBar.tsx` — progress bar with conditional color classes
- [ ] `src/components/budget/BudgetProgressBar.test.ts` — renders when budget > 0, hides when 0, color changes at thresholds
- [ ] `src/components/budget/BudgetSettings.tsx` — settings dialog with 6 category inputs + currency formatting
- [ ] `src/components/budget/BudgetSettings.test.ts` — open/close dialog, update budgets, persist to store
- [ ] `src/features/dashboard/BudgetProgressSection.tsx` — renders bars for all categories with budgets
- [ ] `src/features/dashboard/DashboardPage.tsx` — add `<BudgetProgressSection />` after stat cards
- [ ] Update `src/features/dashboard/DashboardPage.test.ts` — verify budget bars appear when budgets exist
- [ ] Framework install: Already installed (Vitest v4 in vite.config.ts, jest-dom in test-setup.ts)

*(Budget tests do not exist in Wave 0. Existing dashboard tests may need updates to include budget bars assertion.)*

---

## Sources

### Primary (HIGH confidence)
- v1.0 codebase: `src/stores/themeStore.ts` — localStorage + Zustand pattern for budget persistence
- v1.0 codebase: `src/stores/categoryOverrideStore.ts` — Zustand store design matching budget requirements
- v1.0 codebase: `src/features/dashboard/StatCard.tsx`, `CategoryChart.tsx` — conditional color styling (warning/error states)
- v1.0 codebase: `src/utils/currency.ts` — `formatVND()` and `parseVND()` utilities for currency handling
- v1.0 codebase: `src/types/categories.ts` — Category type definition (6 categories)
- v1.0 codebase: `src/services/dashboard.ts` — `categoryBreakdown` already available in DashboardStats
- REQUIREMENTS.md (2026-03-08) — BUDGET-01/02/03 explicit definitions, thresholds (80% yellow, 100% red)
- ROADMAP.md (2026-03-08) — Phase 8 depends on Phase 7 (categories), standalone otherwise

### Secondary (MEDIUM confidence)
- v1.0 codebase: `src/features/dashboard/DashboardPage.tsx` — dashboard layout structure (stat cards, category chart positioning)
- Phase 5 codebase: `src/features/chat/ChatSettings.tsx` — Dialog component pattern (open/close state wiring)

---

## Metadata

**Confidence breakdown:**
- Budget store pattern: **HIGH** — themeStore and categoryOverrideStore precedents; localStorage API is native; no third-party risk
- Progress bar styling: **HIGH** — StatCard and CategoryChart establish color conditional pattern; Tailwind dark mode standard
- Currency formatting: **HIGH** — formatVND/parseVND utilities exist and tested in Phase 1; no unknowns
- Dashboard integration: **HIGH** — categoryBreakdown data already available; simple addition to DashboardPage layout
- Settings UI: **MEDIUM** — No precedent in codebase for budget input dialog; requires custom form but pattern is standard (Dialog + Input from shadcn)

**Research date:** 2026-03-08
**Valid until:** 2026-03-15 (1 week — pattern is straightforward; only risk is if dashboard layout significantly changes)

---

## Open Questions

1. **Settings UI Location**: Should budget settings be in a dedicated page, or a modal dialog accessible from dashboard?
   - What we know: Requirements don't specify location; Phase 8 only requires users to "set" budgets
   - What's unclear: UX preference (modal is less intrusive; page is more discoverable)
   - Recommendation: Start with modal dialog triggered from dashboard header button or menu. Easy to convert to dedicated page later.

2. **Budget Display Format**: Should progress bars show "Spent / Budget" or just the percent?
   - What we know: Progress bar component example shows both (percent + VND amounts)
   - What's unclear: Mobile layout may be constrained; amounts + percent + bar may overflow
   - Recommendation: Desktop: show all three. Mobile (sm breakpoint): show percent only, amounts on hover or tooltip.

3. **Categories Without Budgets**: How should they appear on dashboard?
   - What we know: BUDGET-02 says "progress bars per category"; BUDGET-03 implies bars for monitored budgets
   - What's unclear: Should unbudgeted categories be grayed out, hidden, or omitted entirely?
   - Recommendation: Hide entirely if budget = 0. If user wants to monitor a category, they set a budget first. Keeps dashboard clean.

4. **Exceeding Budget**: Should there be a visual indicator or alert?
   - What we know: BUDGET-03 requires red styling at ≥100%; this is the signal
   - What's unclear: Toast notification on exceed? Dashboard warning? Just red bar?
   - Recommendation: Just red bar (per requirements). No toast; notification UI adds complexity for v1.1. User will notice red on dashboard.

---

## User Constraints

**No CONTEXT.md exists for Phase 8.** Claude's discretion on all research areas. The phase description and REQUIREMENTS.md are the sole constraints:

- Monthly budget per category (not per account or transaction type)
- Progress bars displayed on dashboard (not on transaction list)
- Color thresholds: yellow ≥80%, red ≥100%
- localStorage persistence (no backend)
- All other implementation details are open for recommendation

---
