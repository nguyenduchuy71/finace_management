# Pitfalls Research

**Domain:** Adding categories, budgets, month-over-month, chatbot UX, and CSV export to an existing React personal finance dashboard
**Researched:** 2026-03-08
**Confidence:** HIGH — based on direct codebase inspection of actual source files. Every pitfall maps to a specific line or pattern in the existing code. Not generic React advice.

---

## Critical Pitfalls

### Pitfall 1: Category Store useShallow Selector Includes Action Functions

**What goes wrong:**
When adding a new `categoryStore` (or extending an existing store with category overrides), developers include action functions inside a `useShallow` selector object. For example: `useShallow((s) => ({ overrides: s.overrides, setOverride: s.setOverride }))`. Zustand v5 `useShallow` performs shallow equality on every key in the returned object. A function reference that changes across renders (common with derived callbacks) causes a new object every render, triggering an infinite re-render loop.

**Why it happens:**
The existing `useFilterParams()` in `filterStore.ts` (lines 43–53) returns only data fields: `accountId`, `dateFrom`, `dateTo`, `searchQuery`, `txType`. No actions are in the selector. The correct pattern is established but not obviously enforced. When adding the category store, a developer writing `useShallow((s) => ({ overrides: s.overrides, setOverride: s.setOverride }))` to get both data and the setter in one hook breaks the pattern silently — no TypeScript error, but a runtime infinite loop.

**How to avoid:**
Follow the exact `filterStore.ts` pattern: selector returns only data fields. Actions are accessed with a separate non-shallow selector: `const setOverride = useCategoryStore((s) => s.setOverride)`. Add a code comment in the new store file mirroring the comment in `filterStore.ts` at line 42. Never include action functions in `useShallow` selectors.

**Warning signs:**
- React DevTools Profiler shows a component rendering infinitely (steady flame graph with no user interaction)
- Browser tab CPU spikes to 100% as soon as the feature renders for the first time
- Console logs "Maximum update depth exceeded" on the category or budget component

**Phase to address:**
The phase creating `categoryStore` (CAT-01). Establish the selector pattern before any components consume the store.

---

### Pitfall 2: Category Classifier Breaks on Transactions Without merchantName

**What goes wrong:**
The `TransactionSchema` in `types/account.ts` (line 19) defines `merchantName` as optional: `z.string().optional()`. Several fixture transactions have no `merchantName` field — income transactions like `"Lương tháng 2/2026"` (tx-vcb-001), `"Chuyển tiền từ TCB"` (tx-vcb-014), and account transfer entries only have `description` and a pre-set `category` field. A classifier that does `merchantName.toLowerCase().includes(...)` throws a runtime error when `merchantName` is undefined.

**Why it happens:**
Developers test the classifier against expense transactions only (most fixture expenses have `merchantName`). Income-type transactions slip through because the category chart only displays expenses. The TypeScript type correctly shows `merchantName` as `string | undefined` but if the classifier is written as `(tx: Transaction) => string` the optional is easily ignored with a non-null assertion `tx.merchantName!`.

**How to avoid:**
Build the classifier to check fields in priority order: (1) existing `category` field if present and non-empty — use it as-is, since all fixture transactions already have `category` set; (2) `merchantName` with case-insensitive includes if `merchantName` is defined; (3) `description` fallback with key phrase matching. Add a unit test that runs the classifier against the complete fixture transaction array (`mockTransactions` from `fixtures/transactions.ts`) and asserts the output matches the existing `category` field for every transaction.

**Warning signs:**
- `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in browser console on first transaction list render
- CategoryChart shows only expense categories, income categories silently disappear
- Classifier unit tests pass but browser throws runtime error on income-type transactions

**Phase to address:**
CAT-01 classifier implementation. Run the classifier against all fixture transactions as a unit test before wiring to any UI component.

---

### Pitfall 3: Month-over-Month Previous Period Query Cache Collides or Stays Disabled

**What goes wrong:**
Two distinct failure modes exist. Mode A: The previous period query uses the same key prefix as the current period — `['dashboardStats', { dateFrom: prevFrom, dateTo: prevTo }]`. TanStack Query assigns different cache entries because the date values differ, so deduplication is not the issue. The issue is that the current-period `useDashboardStats` hook (in `useDashboardStats.ts`) only exposes one query result. Consumers that call `useDashboardStats()` twice or create a `usePreviousDashboardStats()` hook can get into a situation where both hooks read from `dashboardStore`'s `dateFrom`/`dateTo` and compute the "previous" period based on those values — but when `dateFrom` is null (no date range selected), there is no meaningful previous period and the derivation produces `null` dates that get passed to the API as `undefined` params, returning all-time data which is not comparable.

Mode B (more common): The developer adds `enabled: false` guard correctly, but forgets to hide the delta arrows UI when both periods are not loaded. Delta arrows show 0% or NaN% whenever the user first loads the dashboard without a date range.

**Why it happens:**
`dashboardStore.ts` starts with `dateFrom: null, dateTo: null`. The dashboard renders immediately with null dates. A previous-period hook computing `prevFrom = dateFrom - 1 month` gets `null - 1 month = NaN` and sends an invalid API request.

**How to avoid:**
Use a distinct key prefix for the previous period query: `['dashboardStats', 'prev', { dateFrom: prevFrom, dateTo: prevTo }]`. Gate both the previous period query and the delta UI with `enabled: Boolean(dateFrom && dateTo)`. Show delta arrows ONLY when both queries have settled successfully and date range is exactly a calendar month. Compute `prevFrom`/`prevTo` in `src/utils/dates.ts` as a pure function with unit tests.

**Warning signs:**
- Dashboard shows NaN% or `Infinity%` delta on initial load
- MSW browser console shows API calls to `/dashboard/stats` with missing or undefined date params
- Delta arrows always show 0 even after selecting a valid date range

**Phase to address:**
DASH-V2-01. Date utilities and the previous-period hook must exist and be tested before any delta UI is built.

---

### Pitfall 4: Budget Store Category Keys Mismatch API Category Strings

**What goes wrong:**
Budget data stored as `{ [categoryKey: string]: number }` in localStorage. The category keys in the budget store do not match the category strings returned by the MSW `/dashboard/stats` handler. The `categoryBreakdown` from the API uses keys like `'food'`, `'grocery'`, `'dining'`, `'transport'`. `CategoryChart.tsx` (lines 36–47) has `CATEGORY_LABELS` mapping these to Vietnamese display strings (`'Ăn uống'`, `'Thực phẩm'`, etc.). If a developer stores budget keys using the Vietnamese display labels, or conflates `'food'` and `'dining'` into one budget, the progress bars always show 0% because no category in `categoryBreakdown` matches the budget key.

**Why it happens:**
`CategoryChart.tsx` makes the category names highly visible in Vietnamese (`CATEGORY_LABELS`). A developer building the budget UI may use the display label as the key to avoid a separate mapping step. Additionally, the fixture data has both `'food'` (coffee shops, Grab food orders) and `'dining'` (sit-down restaurants) as separate categories — these look like they should be one category to a Vietnamese reader but are distinct API strings.

**How to avoid:**
Define a `VALID_CATEGORIES` constant in a shared `src/features/categories/constants.ts` file (e.g., `['food', 'grocery', 'shopping', 'transport', 'electronics', 'dining', 'entertainment', 'transfer', 'other'] as const`). Budget store type must be `Partial<Record<ValidCategory, number>>`. Add Zod deserialization in the budget store's localStorage load function that strips keys not in `VALID_CATEGORIES` — prevents stale keys from accumulating after category renames.

**Warning signs:**
- All budget progress bars show 0% regardless of transactions present
- `Object.keys(budgets)` in browser console returns Vietnamese strings or keys not matching `categoryBreakdown` items
- localStorage `finance-budgets` key contains display labels instead of API slugs

**Phase to address:**
BUDGET-01 store creation. The `VALID_CATEGORIES` source of truth must exist before any budget UI component is built.

---

### Pitfall 5: Budget Progress Bar Component Added Inside CategoryChart Subtree

**What goes wrong:**
`CategoryChart.tsx` has a critical comment at lines 84–96: `useMemo depends ONLY on categoryBreakdown`. Adding a budget progress bar section as a child of `CategoryChart` — or passing a budget store subscription into the same component — adds a Zustand subscription inside the Recharts subtree. When the user types in a budget input field (updating the budget store), the store update triggers a re-render in `CategoryChart`. This re-evaluates `data?.categoryBreakdown ?? []` in `DashboardPage.tsx` (line 83), and since `?? []` creates a new array reference on every render when `data` is undefined (or even when `data` is defined, `??` short-circuits to a fresh array only when falsy), the `useMemo([categoryBreakdown])` dependency is considered changed. Recharts re-mounts and re-animates the entire chart on every budget field keystroke.

**Why it happens:**
The grid layout in `DashboardPage.tsx` (lines 78–86) has one slot for `CategoryChart`. Adding budget progress bars to the same card seems like a natural grouping: "spend by category + budget for category". The budget store subscription is added inside `CategoryChart` or a wrapper component inside the chart's grid cell.

**How to avoid:**
Budget progress bars must be a separate grid item or a card below the dashboard grid — not inside `CategoryChart`. The `DashboardPage.tsx` grid has `sm:col-span-2 lg:col-span-1` for the chart — add a `sm:col-span-2 lg:col-span-3` full-width row below for budget progress bars. Also replace the `?? []` fallback at `DashboardPage.tsx` line 83 with a module-scope constant: `const EMPTY_BREAKDOWN: CategoryBreakdownItem[] = []`, passed as the fallback. This eliminates the new-reference-on-render problem regardless of budget placement.

**Warning signs:**
- React DevTools Profiler shows `CategoryChart` re-rendering when budget input field changes
- Recharts donut/bar animation replays every time user types in budget field
- Chart appears to flicker or reset briefly on budget save

**Phase to address:**
BUDGET-02 dashboard integration. Audit CategoryChart memoization and DashboardPage layout before adding any budget components to the dashboard grid.

---

### Pitfall 6: CSV Export Uses Infinite Query Pages Instead of a Full Dataset Fetch

**What goes wrong:**
`useChatApi.ts` (line 41) establishes a pattern: `transactionPages?.pages.flatMap((p) => p.data)`. This is correct for the chatbot (capped at 20 for token limits). If CSV export copies this pattern, the exported CSV only contains the pages the user has loaded via infinite scroll — typically the first 20 transactions. A user with a "February 2026" filter expects all 38+ transactions, but gets the first 20. The bug is invisible when the total transaction count is less than the default page size.

**Why it happens:**
`useChatApi.ts` is the only existing example of consuming transaction data outside of the transaction list component. It is the natural reference point for any new feature that needs transaction data. The chatbot's 20-transaction cap looks like a limitation specific to the chatbot — a developer copying the pattern for CSV may remove the `.slice(0, 20)` cap without realizing the `pages.flatMap` is still only the loaded pages.

**How to avoid:**
CSV export must NOT use the infinite query. Add a `getTransactionsForExport(accountId: string, filters: TransactionFilters): Promise<Transaction[]>` function in `src/services/accounts.ts` that makes a single API call with `limit=1000` (or the API maximum) and no cursor, using the current filter params from `filterStore`. This is a separate code path from the infinite scroll. The query key for this one-off call must differ from `['transactions', ...]` to avoid cache collision: use `['transactions', 'export', accountId, filters]` or simply do not cache it at all (call outside TanStack Query, directly via `getTransactionsForExport`).

**Warning signs:**
- Exported CSV has exactly 20 rows regardless of the filter showing more transactions in the list
- Export row count varies between sessions based on how far the user scrolled
- User reports "missing February transactions" in the exported file despite them being visible in the app

**Phase to address:**
EXP-01. This is the first architectural decision for CSV export and must be established before any UI button is built.

---

### Pitfall 7: Conversation Starters Call sendMessage Before apiConfig Loads from localStorage

**What goes wrong:**
`chatStore.ts` loads `apiConfig` synchronously from localStorage in the initial store state (line 82: `apiConfig: loadApiConfig()`). If conversation starter buttons trigger `sendMessage` on mount via `useEffect`, or if a starter click fires before the store hydrates on first render, `apiConfig` is null for one React cycle. `useChatApi.ts` (lines 47–54) has a guard: when `apiConfig` is null, `addMessage({ role: 'error', content: 'Chưa cấu hình API...' })` is called. This error message is immediately persisted to localStorage by `saveMessages()`. On every subsequent page load, the first thing the user sees in the chat history is an error message they never caused.

**Why it happens:**
React 19 strict mode double-invokes effects. A `useEffect(() => sendMessage(starter), [])` on a conversation starter component fires twice in development. The first invocation may hit the null-config guard before the store has settled. Even in production, a race between React render and localStorage synchronous read (which is fast but still a tick) can produce this on slow devices.

**How to avoid:**
Conversation starters must only pre-fill the `ChatInput` field — never auto-send. The user presses Enter or the send button to send. This eliminates the timing issue entirely. Implement as: starter button `onClick` sets the input field value (via a shared ref or a callback prop to `ChatInput`). Do not use `useEffect` to trigger sends. If auto-send is a hard requirement, gate it strictly: `useEffect(() => { if (apiConfig?.apiKey) sendMessage(starter) }, [apiConfig])`.

**Warning signs:**
- "Chưa cấu hình API" error message appears in chat on every page load before user interacts
- The error is present in localStorage `finance-chat-history` key after first install
- In React DevTools, `ChatInput` shows a message being sent during component mount (Profiler flame graph shows sendMessage in the mount phase)

**Phase to address:**
CHAT-UX-01. Define the interaction model (pre-fill only) before any conversation starter component is built.

---

### Pitfall 8: Month-Over-Month Date Boundaries Drift by UTC+7 Offset

**What goes wrong:**
The existing codebase uses `Date.UTC(y, m, d, 17, 0, 0)` as the billing cycle boundary (17:00 UTC = midnight Vietnam UTC+7, documented in PROJECT.md key decisions). Month-over-month comparison requires computing "start of last month" and "start of this month" as date strings for API params. Using `new Date(year, month - 1, 1)` computes a local-time date — which is correct in Vietnam (UTC+7) but produces a UTC date that is 7 hours off when serialized with `.toISOString()`. The API handler in `handlers.ts` (line 41) compares with: `tx.transactionDate >= dateFrom`. A `dateFrom` of `2026-02-01T00:00:00+07:00` serialized as UTC becomes `2026-01-31T17:00:00Z`. Late-evening January 31 transactions appear in February's stats.

**Why it happens:**
Developers compute month boundaries with `new Date(year, month - 1, 1).toISOString().slice(0, 10)` which gives the correct calendar date string but incorrect UTC boundary. The fixture data has most transactions at morning hours Vietnam time (UTC 01:00–08:00) which are still the same calendar day in UTC. The boundary error only appears for transactions timestamped after 17:00 UTC (midnight Vietnam) — a relatively rare edge case in the fixture data that won't be caught in casual testing.

**How to avoid:**
Add `getCalendarMonthBoundaries(year: number, month: number): { dateFrom: string, dateTo: string }` to `src/utils/dates.ts`. This function must return ISO date strings that, when compared to UTC transaction timestamps in the MSW handler, produce correct Vietnam-local calendar month groupings. Since the handler compares date strings directly (`>=`), pass `dateFrom` as the start of the Vietnamese midnight in UTC: compute as `new Date(Date.UTC(year, month - 1, 1) - 7 * 3600 * 1000).toISOString()`. Add unit tests for the December-to-January, January-to-February (28/29 day), and February-to-March boundaries.

**Warning signs:**
- Month-over-month totals are slightly off and vary by how many late-evening transactions exist in the period
- Unit tests for month boundaries pass in UTC CI but produce different values when run locally in Vietnam (UTC+7)
- `dateFrom` param visible in MSW browser console shows `2026-01-31T17:00:00.000Z` when user selects "February 2026"

**Phase to address:**
DASH-V2-01. Date utility functions must be written and tested before the previous-period query hook is implemented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store category overrides as `Record<string, string>` with untyped string keys | Fast to implement | Unknown keys accumulate in localStorage; no validation on load; stale keys silently break budget display | Never — use `Record<ValidCategory, string>` with Zod deserialization from the start |
| Compute "previous month" inline in the previous-period hook | No utility function needed | Logic duplicated if other features need the same period math; untested date boundary logic | Never — extract to `src/utils/dates.ts` and unit test all boundaries before the hook exists |
| Use `transactionPages?.pages.flatMap()` pattern for CSV export | Reuses existing data, no extra API call | Silently exports only loaded pages; user gets incomplete data with no error shown | Never — always make a dedicated export fetch |
| Category classification rules as hardcoded switch statement | Simple to read and modify | Cannot be configured without code change; hard to test as data; merchant names vary in real API | Acceptable for v1.1 if rules are in a data structure (array of `{ match, category }` objects) not in a switch statement |
| Budget store without Zod deserialization on localStorage load | Faster initial implementation | Stale category keys from any future rename silently corrupt budget display; no recovery path | Never — add Zod parse with `.catch(() => ({}))` fallback from the start |
| Import `categoryBreakdown ?? []` as inline fallback | One-line convenience | Creates a new array reference on every render, defeating useMemo in CategoryChart | Never — use a module-scope `const EMPTY: CategoryBreakdownItem[] = []` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TanStack Query + month-over-month | Reuse `['dashboardStats', { dateFrom, dateTo }]` key with previous-period dates | Use distinct key prefix `['dashboardStats', 'prev', { dateFrom: prevFrom, dateTo: prevTo }]` for previous period |
| Zustand v5 + new categoryStore | `create<State>(set => ...)` (single curry — v4 pattern) | `create<State>()(set => ...)` (double curry — Zustand v5 requirement, matches filterStore.ts pattern) |
| MSW handlers + client-side category override | Expecting MSW to return reclassified categories after user override | User overrides live in Zustand only — MSW always returns original `category` field; classifier runs client-side on API response |
| CSV Blob + Vercel frontend-only | Attempting to use a Vercel serverless function for CSV generation | Client-side `new Blob([csv], { type: 'text/csv;charset=utf-8;' })` + `URL.createObjectURL()` is the correct approach; no serverless function needed |
| Anthropic SDK + conversation starters | Calling `sendMessage(starterText)` inside `useEffect` on mount | Pre-fill `ChatInput` field value only; do not auto-send; user must press Enter or send button |
| `navigator.clipboard.writeText` + iOS Safari | Calling clipboard API outside user gesture handler (e.g., inside setTimeout) | Call `clipboard.writeText()` directly inside `onClick` handler only; iOS Safari requires a user gesture in the call stack |
| CSV export + infinite query | Using `useTransactions()` data for export | Dedicated `getTransactionsForExport()` service function with limit=1000 and no cursor, called outside TanStack Query |
| Dashboard + null dateFrom | Computing `prevDateFrom` when `dateFrom` is null returns `Invalid Date` | Guard: previous-period query `enabled: Boolean(dateFrom && dateTo)`; hide delta UI when guard is false |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `categoryBreakdown ?? []` inline fallback in DashboardPage | CategoryChart useMemo recalculates on every parent render including unrelated state updates | Replace with module-scope `const EMPTY_BREAKDOWN: CategoryBreakdownItem[] = []` at `DashboardPage.tsx` top | Immediate — affects every render cycle while data is loading |
| Budget store subscription inside CategoryChart subtree | Chart re-animates on every budget field keystroke; Recharts animation plays repeatedly | Keep budget progress bars as sibling component outside CategoryChart grid cell | Immediate — visible as chart flicker whenever budget input is edited |
| Two `useQuery` calls loading concurrently in DashboardPage | Layout shift as current and previous period queries settle at different times | Coordinate loading states: show skeleton until both queries are settled, or stagger with `placeholderData` | First render after date range change — users see shift from one layout to another |
| Category classifier running inline in render | Re-classifies all transactions on every filter change | `useMemo([transactions])` wrapping the classifier call; classifier itself must be a pure function | When transaction list exceeds ~50 items with multiple filter changes per second |
| CSV export blocking main thread during string generation | UI freezes briefly during large export | For >500 transactions consider `Web Worker`; for the expected scale (70 fixture transactions) inline string generation is acceptable | At ~2,000+ transactions on low-end devices |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API key stored in chatStore localStorage in plaintext | Key visible to any JS on the same origin; visible in Application tab DevTools | Accepted risk for personal single-user app; document in settings UI that the key is stored locally |
| CSV export includes full transaction descriptions with merchant names | No risk for personal app; if file is shared accidentally, spending habits are exposed | Out of scope for v1.1; consider "anonymize export" option only if sharing features are added later |
| Category override keys rendered as React children without escaping | XSS if a future feature allows user to enter custom category names | All existing shadcn/ui components render as text content, not innerHTML; safe with current implementation; flag if user-defined category names are added |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Budget progress bar shows `NaN%` when category has no transactions | Confusing display; looks like a bug | Guard: `totalSpent === 0 ? 0 : Math.round((totalSpent / budget) * 100)` |
| Month-over-month delta shown for arbitrary date ranges (e.g., 3-day range) | "Up 40% vs last period" is meaningless for non-monthly ranges | Only show delta arrows when selected range is exactly one calendar month, or when using the default current-month view |
| CSV filename is generic `transactions.csv` | Cannot distinguish multiple exports; browser prompts to overwrite | Include filter context in filename: `transactions-2026-02.csv` or `transactions-vcb-2026-02.csv` |
| Conversation starters disappear after first message is sent | User cannot revisit starters without clearing chat history | Show starters as a collapsible section above the input, visible regardless of message count |
| Copy button shows no feedback after click | User cannot tell if copy succeeded; may press multiple times | Change icon from Copy to Check for 2 seconds on success; revert automatically |
| Budget at 100% and at 80% look identical (same progress bar style) | No visual urgency when user hits their limit | Color: green below 75%, amber 75–99%, red at 100% or above |
| Delta arrows with no tooltip explaining the comparison period | User does not know what "last period" means | Tooltip on hover/tap: "Tháng 1/2026: đ X" showing the actual previous period value |

---

## "Looks Done But Isn't" Checklist

- [ ] **Transaction categories:** User override stored in Zustand/localStorage — verify override survives page refresh AND is not wiped by TanStack Query refetch returning original API `category` field
- [ ] **Transaction categories:** Classifier runs on all fixture transactions including income transactions with no `merchantName` field (tx-vcb-001, tx-vcb-014, and similar) — verify no `TypeError: Cannot read properties of undefined`
- [ ] **Budget tracking:** Budget store keys validated against `VALID_CATEGORIES` on localStorage load — verify a budget key not in the valid list is silently dropped, not a runtime error
- [ ] **Budget tracking:** Progress bar shows correct combined spend when category has both bank transactions (from `mockTransactions`) AND credit card transactions (from `mockCreditCardTransactions`) — verify against the handler's `categoryBreakdown` which already merges both
- [ ] **Month-over-month:** `enabled` guard prevents previous-period query when no date range is selected — check MSW browser console for unexpected calls to `/dashboard/stats` on initial page load
- [ ] **Month-over-month:** Date boundary tested for February (28 days), the January-to-February transition, and the December-to-January year boundary
- [ ] **Month-over-month:** Delta UI is hidden (not showing 0%) when date range is not selected
- [ ] **Chatbot UX:** Conversation starter button pre-fills input but does NOT auto-send — verify by clearing API config, reloading, clicking a starter, confirming no error message appears before user presses send
- [ ] **Chatbot UX:** Copy button tested in iOS Safari (requires user gesture in call stack) — not only in Chrome DevTools
- [ ] **CSV export:** Export with a filter that shows >20 transactions in the list — verify the CSV row count equals the MSW handler's `total` field, not the number of loaded pages
- [ ] **CSV export:** VND amounts in CSV are raw integers (`1500000`) not formatted strings (`đ 1.500.000`) — verify the amount column is numeric-parseable

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| useShallow selector includes actions — infinite re-render | LOW | Remove action functions from the selector object; access actions via direct (non-shallow) selector; hotfix deploy |
| Budget store keys mismatch API category strings | MEDIUM | Add localStorage migration function: read old store, remap keys to `VALID_CATEGORIES`, write back; run on store initialization |
| CSV export truncating to loaded pages | LOW | Replace `pages.flatMap` pattern with dedicated `getTransactionsForExport` service call; single function change, no component restructure |
| Month-over-month date boundary off by UTC+7 hours | LOW | Fix `getCalendarMonthBoundaries` utility; unit tests will catch regressions; redeploy |
| Conversation starter auto-sends before API config loads | LOW | Remove `useEffect` auto-send; switch to pre-fill only; add a one-time localStorage cleanup to remove persisted error messages |
| CategoryChart re-renders on budget store updates | MEDIUM | Move budget progress bars to a sibling component outside CategoryChart's grid cell in DashboardPage; fix the `?? []` fallback to a stable constant; requires component restructure |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| useShallow selector leaks action functions | CAT-01 category store creation | Code review: all `useShallow` selectors in the new store return only data fields; run React DevTools Profiler and confirm no infinite render |
| Classifier breaks on missing merchantName | CAT-01 classifier implementation | Unit test: run classifier on full `mockTransactions` array; assert output matches existing `category` field for all 70 transactions |
| Previous-period query missing enabled guard | DASH-V2-01 hook implementation | Check MSW browser console on initial load with no date range: confirm only one `/dashboard/stats` call, not two |
| Budget store category key mismatch | BUDGET-01 store creation | Unit test: deserialize a budget object with an invalid key; assert the invalid key is stripped by Zod |
| CategoryChart memoization broken by budget subscription | BUDGET-02 dashboard grid integration | React Profiler: edit a budget value; confirm `CategoryChart` component does NOT appear in the re-render flame graph |
| CSV exports only loaded pages | EXP-01 export service function | Test with filter returning >20 results; verify `exportedRows.length === apiResponseTotal` |
| Conversation starters auto-send before config loads | CHAT-UX-01 interaction model definition | Clear localStorage, reload, click starter button; confirm no error message in chat; confirm input field is pre-filled |
| Copy button fails silently on iOS Safari | CHAT-UX-02 copy hook implementation | Test on real iOS Safari; confirm icon changes to Check on tap and content pastes in Notes app |
| Month boundary UTC+7 drift | DASH-V2-01 date utilities | Unit test `getCalendarMonthBoundaries` in UTC environment (set TZ=UTC); verify December, January-to-February, February-to-March boundaries |

---

## Sources

- Direct codebase inspection: `src/stores/filterStore.ts` — useShallow selector pattern (lines 43–53)
- Direct codebase inspection: `src/stores/chatStore.ts` — localStorage persistence pattern, apiConfig null guard (lines 38–73, 82)
- Direct codebase inspection: `src/stores/dashboardStore.ts` — initial null dateFrom/dateTo state
- Direct codebase inspection: `src/features/dashboard/CategoryChart.tsx` — useMemo comment and `?? []` risk (lines 84–96)
- Direct codebase inspection: `src/hooks/useDashboardStats.ts` — queryKey shape `['dashboardStats', { dateFrom, dateTo }]`
- Direct codebase inspection: `src/hooks/useTransactions.ts` — infinite query key shape, undefined sentinel pattern
- Direct codebase inspection: `src/features/chatbot/useChatApi.ts` — pages.flatMap pattern for transaction context (line 41), apiConfig guard (lines 47–54)
- Direct codebase inspection: `src/mocks/handlers.ts` — date comparison logic `tx.transactionDate >= dateFrom` (line 41), category aggregation (lines 149–159)
- Direct codebase inspection: `src/mocks/fixtures/transactions.ts` — merchant names, category strings, income transactions without merchantName
- Direct codebase inspection: `src/types/account.ts` — merchantName as `z.string().optional()` (line 19)
- Direct codebase inspection: `src/pages/DashboardPage.tsx` — `data?.categoryBreakdown ?? []` fallback (line 83), grid layout
- Project MEMORY.md: v1.0 key decisions — UTC+7 billing cycle boundary, queryKey filter params, Zustand v5 double-curry
- PROJECT.md: v1.1 feature requirements, known tech debt (bundle size, real API schema unknown)

---

*Pitfalls research for: v1.1 feature additions to FinanceManager personal finance dashboard*
*Researched: 2026-03-08*
