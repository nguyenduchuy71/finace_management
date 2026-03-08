# Stack Research — v1.1 Additions

**Domain:** Frontend-only personal finance dashboard — v1.1 smart insights & polish
**Researched:** 2026-03-08
**Confidence:** HIGH for "already covered" conclusions (direct codebase inspection); MEDIUM for new library versions (WebSearch verified, npm pages inaccessible for direct confirmation)

---

## Context: What This File Covers

This replaces the v1.0 STACK.md with a v1.1-focused analysis.
The existing stack is **locked and not re-researched** — it works.
This file answers: "What NEW libraries are needed, and what is already covered?"

**Existing locked stack (from package.json as of 2026-03-08):**
React 19 + TypeScript 5.9, Tailwind CSS v4, shadcn/ui (New York), TanStack Query v5,
Zustand v5, React Router v7, Anthropic SDK 0.78, Recharts 3.7, date-fns v4 + @date-fns/tz v1,
axios v1, zod v4, react-markdown v10, sonner v2, lucide-react v0.576, MSW 2.x, Vitest v4.

---

## Feature-by-Feature Coverage Analysis

### Feature 1: Transaction Category Classification (CAT-01, CAT-02, CAT-03)

**What it requires:**
- Rule-based keyword/merchant matching → assign category string
- User override stored persistently
- Category displayed on `TransactionRow`

**Already covered by existing stack:**

| Need | Covered By | Notes |
|------|-----------|-------|
| Rule matching logic | Pure TypeScript — no library | Keyword → category map; `category` field already on `Transaction` type (optional string); fixture data already has category values like `'food'`, `'transport'`, `'shopping'` |
| Category labels + colors | Already in `CategoryChart.tsx` | `CATEGORY_LABELS` and `CATEGORY_COLORS` maps exist in `src/features/dashboard/CategoryChart.tsx` — share, don't duplicate |
| User override persistence | Zustand v5 + `persist` middleware | Zustand's built-in `persist` middleware writes to `localStorage`; already used for `chatStore` (chat history, API config) and `filterStore` — same pattern applies for override map |
| UI for override | shadcn/ui `Select` (already installed) | `Select`, `Badge`, `Button` are all available in `src/components/ui/` |

**New library needed:** None. Rule engine is a plain TypeScript module (`src/utils/categorize.ts`). Override store uses Zustand `persist` — already a project dependency.

**Pattern to follow:**
```typescript
// src/utils/categorize.ts — pure function, no library
const MERCHANT_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /grab|be\s|xanh\s?sm/i, category: 'transport' },
  { pattern: /shopee|lazada|tiki/i, category: 'shopping' },
  { pattern: /circle\s?k|gs25|7-eleven/i, category: 'food' },
  // ...
]
export function classifyTransaction(description: string, merchantName?: string): string {
  const text = `${description} ${merchantName ?? ''}`.trim()
  return MERCHANT_RULES.find(r => r.pattern.test(text))?.category ?? 'other'
}
```

Override store uses `zustand/middleware`'s `persist` with `localStorage`, identical to existing `chatStore` pattern.

---

### Feature 2: Monthly Budget Tracking (BUDGET-01, BUDGET-02, BUDGET-03)

**What it requires:**
- Store per-category monthly budget amounts (VND integers)
- Compare budget vs actual spend (from existing dashboard stats)
- Progress bar UI on dashboard
- Alert when approaching limit (>80% threshold)

**Already covered by existing stack:**

| Need | Covered By | Notes |
|------|-----------|-------|
| Budget data persistence | Zustand v5 `persist` middleware → localStorage | Same pattern as `chatStore`; no backend required |
| Spend data | TanStack Query `useDashboardStats` hook | `categoryBreakdown` from `/dashboard/stats` already returns `{ category, amount }[]` — budget progress = `(actual / budget) * 100` |
| Progress bar component | shadcn/ui `Progress` — **needs to be added via CLI** | `Progress` is NOT in `src/components/ui/` yet (current contents: badge, button, calendar, card, input, popover, select, skeleton, sonner, tabs); install with `npx shadcn add progress` |
| Alert / toast when >80% | `sonner` (already installed) | `toast.warning()` from sonner; already used in `ChatMessage.tsx` |
| Category labels | `CATEGORY_LABELS` in `CategoryChart.tsx` | Extract to shared util |

**New library needed:** None. One new shadcn component (`progress`) added via CLI — this is not a new npm dependency, it generates a component file using existing Radix UI and Tailwind.

**Installation:**
```bash
npx shadcn add progress
# Generates: src/components/ui/progress.tsx
# Uses: @radix-ui/react-progress (already a transitive dep via radix-ui)
```

---

### Feature 3: Month-over-Month Comparison Dashboard (DASH-V2-01, DASH-V2-02)

**What it requires:**
- Compute "this month" vs "last month" date ranges
- Call `/dashboard/stats` twice (or extend API to return both)
- Show delta percentage on stat cards
- `StatCard` needs a delta prop slot

**Already covered by existing stack:**

| Need | Covered By | Notes |
|------|-----------|-------|
| Date boundary calculation | `date-fns` v4 (already installed) | `startOfMonth`, `endOfMonth`, `subMonths` are all available; project already uses `date-fns` for display formatting |
| Vietnam timezone boundaries | `@date-fns/tz` v1 (already installed) | `TZDate` pattern already established in `src/utils/dates.ts` |
| Two dashboard queries | TanStack Query v5 (already installed) | Two `useQuery` calls with different date params; TQ deduplicates if params match |
| Delta arrow icons | `lucide-react` (already installed) | `TrendingUp`, `TrendingDown` already imported in `StatCard.tsx`; `ArrowUp`, `ArrowDown` also available |
| Percentage calculation | Pure math — no library | `((thisMonth - lastMonth) / lastMonth) * 100` |

**New library needed:** None. Pure date-fns calls + second TanStack Query instance.

**Date range pattern:**
```typescript
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { TZDate } from '@date-fns/tz'

const VN_TZ = 'Asia/Ho_Chi_Minh'
const now = new TZDate(new Date(), VN_TZ)

const thisMonthStart = startOfMonth(now).toISOString().slice(0, 10)
const thisMonthEnd   = endOfMonth(now).toISOString().slice(0, 10)
const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString().slice(0, 10)
const lastMonthEnd   = endOfMonth(subMonths(now, 1)).toISOString().slice(0, 10)
```

Note: The existing `DashboardPage` uses the user-selected date range from `dashboardStore`. Month-over-month comparison should use fixed current/prior month ranges independent of that filter — consistent with the existing `dashboardStore` → `filterStore` independence decision documented in `PROJECT.md`.

---

### Feature 4: Chatbot UX Polish (CHAT-UX-01, CHAT-UX-02, CHAT-UX-03)

**What it requires:**
- Conversation starter chips (clickable preset questions)
- Copy button on assistant messages
- Better visual polish (cleaner bubbles, improved empty state)

**Already covered by existing stack:**

| Need | Covered By | Notes |
|------|-----------|-------|
| Copy button | Already implemented | `ChatMessage.tsx` already has a copy button using `navigator.clipboard.writeText` + `sonner` toast; confirmed in codebase |
| Conversation starters UI | shadcn/ui `Button` variant="outline" (already installed) | Chips are just styled buttons that call `useChatApi` or dispatch to `chatStore` |
| Better bubbles | Tailwind CSS (already installed) | CSS-only changes to existing `ChatPanel.tsx` and `ChatMessage.tsx` |
| Empty state improvements | Tailwind + lucide-react (already installed) | `Bot` icon already used; update text content only |

**New library needed:** None. The copy button and most UX polish is already in the codebase (`ChatMessage.tsx` lines 18-24 and 101-125 show copy + regenerate). Conversation starters are pure React + Tailwind — preset strings rendered as `Button` chips that call the existing `useChatApi` hook.

---

### Feature 5: CSV Export of Filtered Transactions (EXP-01, EXP-02)

**What it requires:**
- Convert filtered transaction array to CSV string
- Trigger browser file download
- Handle VND amounts and Vietnamese merchant names (UTF-8)

**Coverage analysis:**

| Need | Covered By | Notes |
|------|-----------|-------|
| CSV serialization | Two options — see below | |
| File download trigger | Native browser API — no library | `URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))` + programmatic anchor click |
| Data source | TanStack Query cache (already in memory) | Filtered transaction pages already loaded via `useInfiniteQuery`; flatten pages for export |
| UTF-8 BOM for Excel | Manual prefix `'\uFEFF'` | Required so Excel 2016+ on Windows opens VND amounts and Vietnamese text correctly without garbled encoding |

**CSV serialization options:**

**Option A: papaparse v5.5.3 (add as dependency)**
- Pros: Handles edge cases (commas in descriptions, quote escaping, special chars), typed with `@types/papaparse`
- Cons: Adds ~24kb minified; an extra dependency for a relatively simple operation
- Use when: Transaction descriptions may contain commas or quote characters (Vietnamese bank descriptions often include commas)

**Option B: Inline manual CSV builder (no new dependency)**
- Pros: Zero bundle cost, full control, trivial to audit
- Cons: Must manually handle escaping; Vietnamese descriptions with commas will break naive implementation
- Use when: You can guarantee description content is safe

**Recommendation: papaparse v5.5.3**

Vietnamese transaction descriptions like `"Chuyển khoản, thanh toán hóa đơn điện, nước"` contain commas and special characters. A naive CSV builder will produce broken files. papaparse's `Papa.unparse()` correctly handles all edge cases, and `@types/papaparse` provides full TypeScript coverage. The ~24kb bundle cost is acceptable given the existing 525KB bundle; it only loads when the user triggers export.

**Installation:**
```bash
npm install papaparse
npm install -D @types/papaparse
```

**Usage pattern:**
```typescript
import Papa from 'papaparse'

export function exportTransactionsCsv(transactions: Transaction[]): void {
  const rows = transactions.map(tx => ({
    'Ngày giao dịch': formatDisplayDate(tx.transactionDate),
    'Mô tả': tx.description,
    'Thương hiệu': tx.merchantName ?? '',
    'Danh mục': tx.category ?? 'other',
    'Số tiền (VND)': tx.amount,
    'Loại': tx.type === 'income' ? 'Thu' : 'Chi',
    'Trạng thái': tx.status === 'posted' ? 'Đã khớp' : 'Chờ',
  }))

  const csv = '\uFEFF' + Papa.unparse(rows)  // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Recommended Stack for v1.1

### New Dependencies (additions to existing package.json)

| Library | Version | Purpose | Why This, Not Alternative |
|---------|---------|---------|--------------------------|
| `papaparse` | ^5.5.3 | CSV serialization for export | Handles commas and special chars in Vietnamese descriptions; `Papa.unparse()` is battle-tested; 24kb cost justified by correctness |
| `@types/papaparse` | latest (devDep) | TypeScript types for papaparse | papaparse ships no built-in types; DefinitelyTyped types updated Dec 2025; typed with `UnparseConfig` and generic `unparse<T>()` |

### Shadcn Components to Add (via CLI, no new npm deps)

| Component | Install Command | Purpose | Already Present? |
|-----------|----------------|---------|-----------------|
| `progress` | `npx shadcn add progress` | Budget progress bars | No — not in `src/components/ui/` |

All other needed shadcn components (`button`, `badge`, `card`, `select`, `tabs`, `skeleton`) are already installed.

### What the Existing Stack Already Covers

| v1.1 Feature | Existing Stack Coverage | Notes |
|-------------|------------------------|-------|
| Category rule engine | Pure TypeScript | `category` field already in `Transaction` type; labels/colors in `CategoryChart.tsx` |
| Category override persistence | Zustand v5 `persist` middleware | Already used in `chatStore`; same pattern |
| Budget storage | Zustand v5 `persist` middleware | Same localStorage pattern |
| Budget progress display | shadcn `progress` (add via CLI) + Recharts already there | Recharts `RadialBarChart` also viable for donut progress |
| Budget alert | `sonner` (already installed) | `toast.warning()` |
| Month-over-month dates | `date-fns` v4 + `@date-fns/tz` v1 | `startOfMonth`, `endOfMonth`, `subMonths` available |
| Month-over-month queries | TanStack Query v5 | Two `useQuery` calls |
| Month-over-month delta icons | `lucide-react` | `TrendingUp`, `TrendingDown`, `ArrowUp`, `ArrowDown` |
| Copy button on chat | Already implemented | `ChatMessage.tsx` lines 18-24 |
| Conversation starters | `Button` + Tailwind | Plain chips, no new library |
| Chat bubble polish | Tailwind CSS | CSS-only changes |
| CSV download trigger | Native browser API | `Blob` + `URL.createObjectURL` |
| CSV UTF-8 for Excel | Manual BOM `'\uFEFF'` | Standard approach |

---

## Installation

```bash
# Only NEW dependencies for v1.1
npm install papaparse
npm install -D @types/papaparse

# Add shadcn progress component (generates file, no new npm dep)
npx shadcn add progress
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `papaparse` (CSV) | Manual CSV builder | Vietnamese descriptions contain commas; naive escaping produces broken Excel files |
| `papaparse` (CSV) | `xlsx` (SheetJS) | xlsx is 800kb+ for a feature the project scope defines as CSV-only; PDF/Excel exports are explicitly deferred to v2.0 |
| `papaparse` (CSV) | `react-csv` | react-csv is a React wrapper over manual CSV building; last npm publish was 2021, effectively unmaintained |
| Zustand `persist` (budget/overrides) | IndexedDB / idb-keyval | localStorage is sufficient for budget amounts (<1kb of data); IndexedDB complexity is unjustified |
| Zustand `persist` (budget/overrides) | Custom localStorage hooks | Zustand `persist` middleware is already the project pattern (chatStore); consistency over custom hooks |
| shadcn `progress` (budget bars) | Recharts `RadialBarChart` | Radial chart adds complexity; linear progress bar communicates budget status more clearly at a glance; shadcn `progress` matches existing design system |
| `date-fns` (month boundaries) | Day.js | Already using date-fns; mixing date libraries creates confusion; no gain |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-csv` | Last published 2021, effectively abandoned | `papaparse` + native Blob download |
| `xlsx` (SheetJS) | 800kb+ bundle; Excel format out of scope for v1.1 | `papaparse` for CSV |
| `@tanstack/react-virtual` | Not needed until transaction list > 500 visible rows; current dataset is 70 bank + 59 CC transactions | Defer to v1.2 if user count grows |
| Any ML/NLP categorization library | Rule-based is sufficient and explicit; ML adds non-determinism and large bundle cost | Plain TypeScript `categorize.ts` |
| `immer` (Zustand middleware) | Overkill for budget store — state shape is a flat `Record<string, number>` | Plain Zustand updates |
| New chart library | Recharts 3.7 already handles all v1.1 chart needs (bar, pie, radial) | Recharts existing install |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `papaparse@5.5.3` | React 19, TypeScript 5.9, Vite 7 | Framework-agnostic; works in any browser environment; no React dep |
| `@types/papaparse@latest` | TypeScript 5.9 | Updated Dec 2025 per DefinitelyTyped; `UnparseConfig` typed generically |
| `shadcn progress` | Tailwind v4, Radix UI (via `radix-ui` already installed) | `@radix-ui/react-progress` is a transitive dep of `radix-ui@1.4.3` already in package.json |
| Zustand `persist` middleware | Zustand v5 (already installed) | Built into `zustand/middleware` — no separate install; double-curry pattern `create<T>()(persist(...))` required |

---

## Sources

- Direct codebase inspection (`package.json`, `src/` file tree, `ChatMessage.tsx`, `CategoryChart.tsx`, `chatStore.ts`, `account.ts` types) — HIGH confidence
- WebSearch: papaparse v5.5.3 npm — MEDIUM confidence (npm page returned 403; search results confirm version 5.5.3, 9 months old as of 2026-03, 2506 dependents)
- WebSearch: `@types/papaparse` updated Dec 2025 on DefinitelyTyped — MEDIUM confidence
- WebSearch: shadcn/ui `progress` component docs (https://ui.shadcn.com/docs/components/radix/progress) — HIGH confidence; built on Radix UI Progress
- WebSearch: Zustand `persist` middleware v5 double-curry `create<T>()(persist(...))` TypeScript pattern — HIGH confidence, multiple concordant sources
- WebSearch: Manual CSV + Blob download pattern (no library) — HIGH confidence, standard Web API
- WebSearch: UTF-8 BOM prefix `'\uFEFF'` for Excel CSV encoding — MEDIUM confidence, widely documented

---

*Stack research for: v1.1 smart insights & polish (transaction categories, budget tracking, month-over-month, chatbot polish, CSV export)*
*Researched: 2026-03-08*
