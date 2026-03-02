# Feature Research

**Domain:** Personal Finance Dashboard (frontend-only, bank + credit card transactions)
**Researched:** 2026-03-02
**Confidence:** MEDIUM — based on industry pattern analysis of Mint, YNAB, Copilot, Monarch Money, Personal Capital/Empower, and standard banking app UX. WebSearch/WebFetch unavailable during research session; findings reflect stable UX patterns from established products.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transaction list — bank account | Core purpose of the app; users need to see what happened in their account | LOW | Date, merchant name, amount, category. Sortable by date descending by default. |
| Transaction list — credit card | Users expect all accounts unified; missing CC transactions breaks the whole-picture promise | LOW | Same fields as bank + card identifier. |
| Account balance display | First thing users check when opening any finance app | LOW | Current balance, available balance. Shown prominently on dashboard. |
| Dashboard overview (net worth / totals) | Users want one-glance financial summary before drilling into details | MEDIUM | Total assets, total liabilities, net balance. Income vs spend this period. |
| Date range filter | All finance apps support this; without it users can't isolate periods | LOW | Preset ranges: today, this week, this month, last month, custom. |
| Transaction search by merchant/description | Users remember "that coffee charge" not the date; search is how they find it | LOW | Text search against merchant name and description fields. |
| Filter by account | Users have multiple accounts and need to view each separately | LOW | Dropdown or tab to isolate bank vs. credit card, or specific account. |
| Filter by transaction type (debit/credit) | Users want to see only income OR only expenses | LOW | Toggle: all / income / expense. |
| Credit card statement date display | This is explicitly in scope; statement dates are how CC users organize their debt | MEDIUM | Show current billing cycle: start date, end date (statement date), due date. |
| Credit card billing cycle grouping | Transactions grouped by billing cycle — not calendar month — matches how CC users think | MEDIUM | Each cycle is a "bucket"; current vs previous cycle clearly delineated. |
| Loading state (skeleton / spinner) | External API calls have latency; blank screen feels broken | LOW | Skeleton loading on transaction list rows is standard UX. |
| Error state (API failure) | Network errors and API failures must not produce blank/broken UI | LOW | Friendly error message + retry button. |
| Empty state | New accounts or filtered-to-zero results need a clear "no transactions" message | LOW | Don't show an empty table with no explanation. |
| Responsive layout | Explicitly required; users check finances on mobile | MEDIUM | Mobile-first for transaction lists; dashboard grid collapses gracefully. |
| Amount formatting | Currency display is expected to be correct (locale, comma separators, negative for debits) | LOW | Use Intl.NumberFormat. Negative amounts in red, positive in green. |
| Transaction date formatting | Relative dates ("Today", "Yesterday", "3 days ago") + absolute for older | LOW | Improves scannability significantly. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Billing cycle summary card | Shows total spend this billing cycle + days until statement date at a glance | MEDIUM | Most dashboards show calendar-month spend; showing CC cycle spend is distinctly useful for CC users managing payment due dates. |
| Spend vs. previous cycle comparison | "You spent 12% more than last billing cycle" — actionable context | MEDIUM | Requires storing/comparing two billing periods of data. |
| Category breakdown chart (current cycle) | Pie/donut chart of spending by category for the current billing cycle | MEDIUM | Recharts or Visx makes this relatively straightforward. Ties to the "organized by billing cycle" core value. |
| Running balance display | Show account balance after each transaction, not just the current balance | MEDIUM | Very useful for debugging "where did my money go." Common in banking apps, less common in aggregators. |
| Sticky/pinned account summary | Account balance and billing cycle info stay visible as user scrolls the transaction list | LOW | CSS position:sticky; high UX value for low implementation cost. |
| Pagination with "load more" | Infinite-scroll / load-more prevents overwhelming initial load for accounts with many transactions | LOW | Better UX than hard pagination for transaction lists. |
| Transaction count badge per account | Show number of transactions in current view/filter | LOW | Small UX win; tells user how many transactions match. |
| Highlight upcoming statement date | Visual indicator (e.g., "Statement closes in 3 days") in billing cycle header | LOW | Highly relevant for the CC billing cycle use case; nudges users to review before statement closes. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Budget creation / budget tracking | Users naturally want to set spending limits | Requires persistent state (localStorage or backend), adds a full data model (budget categories, limits, rollover logic), scope-creeps the read-only promise. Mint had this and it became the most bug-prone feature. | Defer entirely; show actuals clearly and let users do mental math. Add in v2 if validated. |
| Transaction categorization editing | Users want to correct wrong categories from the API | Requires local override state that diverges from API data. Introduces reconciliation complexity. Without backend, overrides reset on refresh. | Display API-provided categories as-is. If categories are consistently wrong, flag to improve mock API. |
| Notifications / alerts (low balance, large transactions) | Users want proactive awareness | Requires push notification infrastructure, background polling, or service worker. Completely out of scope for frontend-only with no backend. | Show current balance prominently; let user check the dashboard. |
| CSV / PDF export | Power users request this | Implementation is straightforward but creates a maintenance surface (formatting, locale handling, column layout). Low usage, high maintenance. | Defer to v2 if users explicitly request it. |
| Manual transaction entry | Users want to add cash transactions | Creates a two-source-of-truth problem with API data. Requires local storage with sync/merge logic. Significant complexity for a read-only dashboard. | Out of scope; document in PROJECT.md explicitly. |
| Real-time transaction updates (WebSocket) | Feels modern and impressive | Bank APIs are batch/polling, not streaming. Plaid-style APIs update on a pull schedule. WebSocket adds infrastructure with no actual latency benefit. | Poll on page load + manual refresh button. |
| Multi-user / sharing | "Share with spouse" requests are common | Requires auth, data isolation, permissions model — entire backend. Completely out of scope for frontend-only. | Single-user; explicitly documented in PROJECT.md Out of Scope. |
| Dark/light mode toggle | Quality-of-life request | Not a finance feature; consumes implementation time. CSS variables make it doable, but it's a distraction from core functionality in v1. | Pick one theme and stick with it. Add in v1.x if users request. |

---

## Feature Dependencies

```
[Dashboard Overview]
    └──requires──> [Account Balance Data]
                       └──requires──> [API Integration / Mock API]
    └──requires──> [Transaction List (Bank)]
    └──requires──> [Transaction List (Credit Card)]

[Transaction List]
    └──requires──> [API Integration / Mock API]
    └──requires──> [Loading State]
    └──requires──> [Error State]
    └──requires──> [Empty State]

[Billing Cycle Grouping]
    └──requires──> [Statement Date Data from API]
    └──requires──> [Transaction List (Credit Card)]

[Billing Cycle Summary Card]
    └──requires──> [Billing Cycle Grouping]
    └──enhances──> [Dashboard Overview]

[Date Range Filter]
    └──requires──> [Transaction List]

[Account Filter]
    └──requires──> [Transaction List]
    └──requires──> [Multiple account types in API]

[Search]
    └──requires──> [Transaction List]

[Category Breakdown Chart]
    └──requires──> [Transaction List (with category field)]
    └──requires──> [Charting library (Recharts/Visx)]

[Spend vs. Previous Cycle Comparison]
    └──requires──> [Billing Cycle Grouping]
    └──requires──> [At least 2 billing cycles of transaction data]
```

### Dependency Notes

- **Dashboard Overview requires API Integration:** The overview has zero data until the API layer is working. This means API integration is the true Phase 1 foundation — not the dashboard UI.
- **Billing Cycle Grouping requires Statement Date from API:** If the third-party API does not return statement date / billing cycle information, this feature needs a fallback (user-configured cycle dates). This is a risk to flag.
- **Date Range Filter and Account Filter require Transaction List:** Build the list first, then layer on filters. Don't build filters against an empty state.
- **Category Breakdown Chart requires category field:** Verify the third-party API returns a category field. Plaid-style APIs do; simpler APIs may not.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **API integration layer (mock + real)** — Nothing else works without data. Build with mock first, swap to real API.
- [ ] **Transaction list — bank account** — Core feature #1 from PROJECT.md requirements.
- [ ] **Transaction list — credit card** — Core feature #2 from PROJECT.md requirements.
- [ ] **Dashboard overview** — Balance, income total, expense total. One-glance summary.
- [ ] **Credit card billing cycle display** — Statement date, cycle start/end. Explicitly in scope per PROJECT.md.
- [ ] **Billing cycle transaction grouping** — Group CC transactions by billing cycle, not calendar month.
- [ ] **Date range filter** — Users must be able to narrow by time period.
- [ ] **Account filter** — Users must be able to view one account at a time.
- [ ] **Search** — Text search on merchant/description.
- [ ] **Loading / error / empty states** — Required for any async data fetch.
- [ ] **Responsive layout** — Desktop and mobile per PROJECT.md constraint.

### Add After Validation (v1.x)

Features to add once core is working and user feedback gathered.

- [ ] **Billing Cycle Summary Card** — High value for CC users; add when core cycle display is confirmed working.
- [ ] **Category Breakdown Chart** — Adds data visualization depth; add after transaction list UX is settled.
- [ ] **Running balance display** — Useful but not essential; add when basic list is validated.
- [ ] **Spend vs. previous cycle comparison** — Requires two full cycles of data to be meaningful.
- [ ] **Highlight upcoming statement date** — Polish feature; add in first iteration after launch.
- [ ] **Dark/light mode toggle** — Aesthetic; add only if users request it.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Budget tracking** — Full feature category; requires significant new data model.
- [ ] **CSV / PDF export** — Power user feature; validate demand before building.
- [ ] **Transaction category editing** — Requires local state management strategy with backend persistence.
- [ ] **Notification/alert system** — Requires push infrastructure.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| API integration (mock + real) | HIGH | MEDIUM | P1 |
| Transaction list — bank | HIGH | LOW | P1 |
| Transaction list — credit card | HIGH | LOW | P1 |
| Dashboard overview (balance, totals) | HIGH | MEDIUM | P1 |
| CC billing cycle display + grouping | HIGH | MEDIUM | P1 |
| Date range filter | HIGH | LOW | P1 |
| Account filter | HIGH | LOW | P1 |
| Transaction search | HIGH | LOW | P1 |
| Loading / error / empty states | HIGH | LOW | P1 |
| Responsive layout | HIGH | MEDIUM | P1 |
| Billing Cycle Summary Card | MEDIUM | LOW | P2 |
| Category breakdown chart | MEDIUM | MEDIUM | P2 |
| Running balance display | MEDIUM | LOW | P2 |
| Spend vs. previous cycle comparison | MEDIUM | MEDIUM | P2 |
| Upcoming statement date highlight | LOW | LOW | P2 |
| Filter by transaction type (income/expense) | MEDIUM | LOW | P2 |
| Dark/light mode | LOW | MEDIUM | P3 |
| CSV export | LOW | MEDIUM | P3 |
| Budget tracking | HIGH | HIGH | P3 |
| Transaction category editing | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Mint (defunct) | Monarch Money | Copilot (iOS) | Our Approach |
|---------|---------------|---------------|---------------|--------------|
| Transaction list | All accounts unified, calendar-month grouping | Unified list, flexible grouping | Per-account + unified, good search | Unified list; CC grouped by billing cycle (not calendar month) |
| Dashboard | Net worth, account balances, budget status | Net worth, cashflow summary | Spending summary, account balances | Simplified: balances + income/expense totals per period |
| CC billing cycle | Calendar-month only (major complaint) | Calendar-month by default | Billing cycle aware | Billing cycle as primary grouping — this is the differentiator |
| Filtering | Date, category, merchant, account | Date, category, account, tags | Date, category, merchant | Date + account + type + text search |
| Search | Basic text search | Full-text search | Good merchant search | Text search on merchant + description |
| Charts | Category pie charts, trend lines | Cashflow bar charts, net worth over time | Spending wheel, category bars | Category donut for current billing cycle (v1.x) |
| Budget tracking | Core feature, complex | Core feature | Optional overlay | Explicitly excluded from v1 |
| Category editing | Yes, manual | Yes, with rules | Yes, AI-assisted | Excluded from v1 |

**Key differentiation opportunity:** Mint (and most aggregators) grouped credit card transactions by calendar month. This misaligned with how CC users actually think — billing cycles don't start on the 1st. Grouping by billing cycle is the core differentiator this product should lean into.

---

## Critical Feature Risk

**Billing cycle data availability from the third-party API:**

The CC billing cycle grouping feature depends on the third-party API returning:
1. Statement/billing cycle start date
2. Statement/billing cycle end date (or "statement date")
3. Payment due date (nice to have)

APIs like Plaid return this via the `/liabilities/get` endpoint (not the transactions endpoint). Simpler APIs may not return it at all. If this data isn't available, the core differentiator of this app cannot be implemented without user-configured cycle dates as a fallback.

**Recommendation:** When building the mock API, include billing cycle data. When integrating the real API, verify this data exists before committing to the feature.

---

## Sources

- Industry analysis of personal finance apps: Mint, YNAB, Monarch Money, Copilot, Personal Capital/Empower — MEDIUM confidence (training data, patterns stable as of August 2025)
- Plaid API transaction and liabilities data model — MEDIUM confidence (training data; verify against current Plaid docs at https://plaid.com/docs/liabilities/ before building)
- Standard banking app UX patterns (Chase, Bank of America, Wells Fargo mobile apps) — MEDIUM confidence (training data)
- PROJECT.md requirements and constraints — HIGH confidence (authoritative project source)

**Note:** WebSearch and WebFetch were unavailable during this research session. All findings from external sources carry MEDIUM confidence. Verify billing cycle API data availability against your specific third-party API before finalizing the architecture.

---
*Feature research for: Personal Finance Dashboard — bank + credit card transactions*
*Researched: 2026-03-02*
