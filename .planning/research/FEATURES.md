# Feature Research

**Domain:** Personal Finance Dashboard (frontend-only, bank + credit card transactions)
**Researched:** 2026-03-02 (v1.0) / 2026-03-08 (v1.1 update)
**Confidence:** MEDIUM-HIGH — v1.0 from industry pattern analysis; v1.1 from WebSearch across fintech UX sources, Vietnamese market data, and NN/Group chatbot research.

---

## v1.1 Feature Research (2026-03-08)

This section covers the five new features for v1.1: transaction categories, budget tracking, month-over-month comparison, chatbot UX polish, and CSV export. v1.0 features are already built; see the v1.0 section below for that research.

---

### Feature 1: Transaction Categories

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-classify on load | Users expect zero manual entry for standard merchants | MEDIUM | Merchant-name regex rules are sufficient; ML not needed |
| Category badge visible on transaction row | Instant visual scan of spending type | LOW | shadcn `Badge` component already in codebase |
| Override any category inline | Users trust their own judgment over auto-classify | LOW | Popover or dropdown on badge click — 1 click, not a modal |
| Override persists across sessions | Corrections lost on refresh = immediate user frustration | LOW | localStorage keyed by transaction ID |
| Neutral fallback category | Every transaction must have a category | LOW | Default "Khác" when no rule matches |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vietnamese merchant recognition | Grab, Shopee, MoMo, VPBank, VNPT, FPT recognized by default | LOW | Regex rules file — easily extensible, no ML cost |
| Override applies to all same-merchant transactions | "Remember my correction for Shopee" with confirm dialog | MEDIUM | Group by merchant name in override store; "Apply to all 12 Shopee transactions?" |
| Category used in budget feature | Categories power the budget value chain | LOW | Shared category enum ensures consistency across features |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| ML/LLM auto-classify per transaction | "Smarter" classification | API cost per transaction, latency on list render, overkill for ~100 txns/month | Regex rules table covers 90% of cases; user override covers the rest |
| User-defined custom categories | "Flexibility" | Category explosion breaks budget UI; users rarely use more than 6-8 categories | Fixed 6 Vietnamese categories with emoji icons; Khác as escape hatch |
| Bulk category editing UI | Power user request | Complexity for minimal gain in personal-use context | Override-all-same-merchant covers the primary need |
| Category icons customizable by user | Visual personalization | Storage bloat, design inconsistency | Fixed icons per category — consistent, zero config |

#### Vietnamese Category Set (Fixed — 6 categories)

Matches Money Lover / Money Keeper (top Vietnamese personal finance apps) conventions:

| Category Key | Display Name | Icon | Typical Merchants |
|---|---|---|---|
| `an-uong` | Ăn uống | 🍜 | Grab Food, Baemin, local restaurants |
| `mua-sam` | Mua sắm | 🛍️ | Shopee, Lazada, Tiki |
| `di-chuyen` | Di chuyển | 🚗 | Grab, Be, xăng dầu, gửi xe |
| `giai-tri` | Giải trí | 🎮 | Netflix, Steam, cinema |
| `hoa-don` | Hóa đơn | 📋 | VNPT, FPT, EVN, tiền thuê nhà |
| `khac` | Khác | 📦 | Everything else (default fallback) |

**Income transactions (credits) should NOT be categorized.** Category badges only apply to debits/expenses.

#### Edge Cases

- **Pending credit card transactions:** Auto-classify same as posted. Override applies when transaction posts.
- **Transfer between own accounts:** Flag as transfer (not expense), exclude from budget calculations.
- **Merchant name variants:** "GRAB*FOOD12345" vs "GRABFOOD" — rules must match partial strings, not exact match.
- **New merchants not in rules:** Fall to Khác silently — no error, no prompt.
- **Override on MSW mock data:** Overrides stored by transaction ID. When real API arrives with different IDs, overrides reset — acceptable for v1.1, document as tech debt.

---

### Feature 2: Budget Tracking

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Set monthly budget per category | Core budgeting behavior | LOW | Inline number input on dashboard or settings panel |
| Progress bar per category on dashboard | Visual "how am I doing" scan | LOW | shadcn `Progress` or custom bar — green/yellow/red states |
| Yellow warning at ~80% | Users want early warning, not post-mortem | LOW | CSS class swap; threshold is a configurable constant |
| Red alert at 100%+ | Exceeded budget needs clear signal | LOW | Destructive color + icon |
| Budget persists across sessions | Budget resets on refresh = useless feature | LOW | localStorage — same pattern as category overrides |
| Zero budget hides progress bar | Users who haven't set a budget should not see a 0/0 confused state | LOW | Conditional render: only show categories with budget > 0 |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Current month auto-scope | Budget compares spending THIS month only; no setup needed | LOW | Use existing dashboardStore month period |
| Remaining amount shown | "đ 350.000 còn lại" is more actionable than "65%" | LOW | Budget minus spent, formatted as VND |
| Total budget summary row | "đ 2.1M / đ 5M this month" at top of widget | LOW | Aggregate across all categories |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Budget rollover (unused budget carries forward) | "Feels fair" | Complicates mental model; confusing for personal use | Static monthly reset — simpler and matches how Vietnamese users think about bills |
| Budget notifications / push alerts | "Remind me when I'm close" | Requires service worker or native push — major complexity, out of scope for web-only | Visual alert on dashboard is sufficient |
| Savings goal tracking | Natural extension | Different feature category (goals vs limits); scope creep | Defer to v1.2 |
| Per-transaction budget deduction animation | Feels responsive | Engineering complexity vs value ratio is poor | Static progress bar recalculates on data refresh |
| Weekly budget breakdowns | Granularity | Overcomplicates personal monthly patterns | Monthly only — aligns with billing cycle mental model |

#### UX Pattern: Budget Setting

Budget entry should be **inline on the dashboard**, not in a separate settings page. Pattern: click category name or edit icon on the progress bar row → inline input appears → blur/enter saves → localStorage write. Reduces friction to under 3 seconds per category setup.

#### Edge Cases

- **First day of month:** Spending is đ0; progress bars show 0%. Correct and expected.
- **Spending exceeds 200%+ of budget:** Cap bar visual at 100% width; show actual percentage in text ("157%"). Do not let bar overflow container.
- **Category has no budget set:** Hide progress bar entirely for that category.
- **Transfer transactions in budget:** Must filter out transfers using transaction `type` field to exclude non-expense transactions.
- **Credit card pending transactions:** Include pending in budget calculation — users need to know committed spend, not just posted.
- **No transactions in category:** Progress bar shows 0% — do not hide if budget is set; user wants to see they're on track.

---

### Feature 3: Month-over-Month Comparison

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Delta vs previous month on income/expense stat cards | Standard fintech dashboard pattern; Mint, Money Dashboard, all major apps include this | LOW | Calculate from existing transaction data |
| Percentage delta formatted clearly | "↑12%" or "↓8%" — directional arrow + percentage | LOW | Format function: sign, arrow character, color |
| Green for improvement, red for worsening | Universal color convention for financial deltas | LOW | Green = spending down or income up; red = spending up or income down |
| "vs tháng trước" label | Contextualizes the comparison in Vietnamese | LOW | Static Vietnamese string |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Absolute amount delta on hover/expand | Power users want both % and VND amount | LOW | Tooltip or card expand: "↑ đ 450.000" |
| Delta on category breakdown (not just totals) | "My food spending went up 23% this month" | MEDIUM | Requires previous month category aggregation; same data layer, different time window |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 3-month or 6-month trend sparklines | "Better trend visibility" | Requires fetching/caching multiple months; significant complexity | Ship month-over-month first; sparklines are v1.2 |
| Predictive "you'll spend X by end of month" | AI-like insight | Unreliable without sufficient data; false precision is worse than no prediction | Flag as v1.2 once real API has 3+ months history |
| Year-over-year comparison | Completionist thinking | Requires 12+ months history that won't exist in v1.1 | Not applicable |

#### Edge Cases

- **New month starts (day 1-3):** Very few transactions; delta shows dramatic changes. Guard: if current month < 5 transactions, show "Chưa đủ dữ liệu" instead of delta.
- **Previous month has zero transactions:** Division by zero in percentage calc. Guard: if prev month total = 0, show "Tháng đầu tiên" or hide delta entirely.
- **Period selector changed away from current month:** Only show delta when period = current calendar month. If user selects a custom range, month-over-month loses meaning — hide it.
- **February:** 28/29 days vs 31-day months — compare raw monthly totals as-is; do NOT normalize by day count (users think in monthly totals).

#### Data Layer Note

Existing `dashboardStore` already tracks the selected period. Month-over-month calculation filters by `[startOfPrevMonth, endOfPrevMonth]` client-side from already-loaded transaction data — no new API calls needed. Designed to work within current MSW mock data.

---

### Feature 4: Chatbot UX Polish

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Conversation starters shown when chat is empty | Every major AI chat UI (Claude, ChatGPT, Gemini) uses this pattern; sets user expectations | LOW | Static array of 3-4 suggested prompts as clickable chips |
| Conversation starters disappear once chat starts | Prompts cluttering an active conversation = noise | LOW | Conditional render on message count > 0 |
| Copy message button on assistant messages | Users want to paste insights into notes or spreadsheets | LOW | Icon button on hover/tap; `navigator.clipboard.writeText` |
| Cleaner message bubbles | Visual distinction between user vs assistant messages | LOW | Tighten padding, consistent avatar/icon, clear visual separation |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Finance-specific Vietnamese conversation starters | Starters tied to the user's data context — not generic AI prompts | LOW | Static hardcoded starters in Vietnamese; contextually relevant |
| Conversation starters reappear after clear | When user clears chat, starters come back — invites re-engagement | LOW | Already handled by "empty messages" condition |
| Timestamp on messages | Users want to know when they asked | LOW | Format: "14:32" — hours:minutes only, no date |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Chat history persistence across sessions | "Convenient" | Storage size grows unbounded; old context is stale; privacy concern on shared devices | Session-only memory — chat clears on refresh; right default for financial data |
| Streaming/partial text display | More "alive" feel | Already decided: typing indicator over streaming (see PROJECT.md key decisions) — changing risks regression | Keep current pattern: typing indicator → full message appears |
| Rich markdown rendering (tables, code blocks) | AI sometimes outputs markdown | Heavy dependency (react-markdown) for minor gain; financial responses rarely need tables | Plain text with basic newline handling |
| Multiple chat sessions / tabs | Power user feature | State management complexity | Single session; clear button is sufficient |
| Voice input | Accessibility | Web Speech API unreliable across browsers; out of scope | Text only for v1.1 |
| Custom system prompt editing by user | Developer-level control | Confusing to non-technical users; system prompt is a product decision | Settings panel shows system prompt as read-only, collapsible |

#### Recommended Conversation Starters (Vietnamese)

These 4 starters cover the most valuable use cases for this app specifically:

1. "Tháng này tôi đã chi bao nhiêu tiền?" — Monthly spending summary
2. "Danh mục nào tôi chi nhiều nhất?" — Top spending category (ties to categories feature)
3. "So sánh chi tiêu tháng này với tháng trước" — Month-over-month insight (ties to comparison feature)
4. "Giao dịch lớn nhất của tôi là gì?" — Largest transaction

#### Edge Cases

- **Copy button on mobile:** `navigator.clipboard` requires HTTPS — already on Vercel, no issue. Show brief "Đã sao chép" toast for 1.5s.
- **Very long assistant messages:** Add max-height with scroll on individual message bubbles if message > ~500 chars — prevents single response dominating the panel.
- **Conversation starters on small screens:** Stack vertically on mobile; horizontal chips only on desktop.
- **Empty chat on initial mount vs after clear:** Both should show starters. Use same "messages.length === 0" condition for both.

---

### Feature 5: CSV Export

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Export currently filtered transactions | Users filtered to what they care about; export must respect that | LOW | Read from existing filterStore filter state |
| UTF-8 BOM for Vietnamese characters | Excel on Windows opens UTF-8 CSV incorrectly without BOM — Vietnamese users primarily use Windows + Excel | LOW | Prepend `\uFEFF` to Blob content — non-negotiable |
| Meaningful filename | `transactions-2026-03.csv` not `download.csv` | LOW | Filename includes date range from current filter |
| Button visible near transaction list | Discoverable — not buried in settings | LOW | Secondary button in transaction list header area |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vietnamese column headers | "Ngày giao dịch, Mô tả, Số tiền, Loại, Danh mục, Tài khoản" — familiar for local users | LOW | Column header array constant |
| Category column included | Makes exported CSV useful for further analysis in Excel | LOW | Only meaningful because categories feature is built first |
| Amount as plain number (not đ string) | Excel needs numeric value for SUM formulas to work | LOW | Export raw integer; strip VND formatting for amount column |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Excel XLSX export | "Better than CSV" | Requires SheetJS (~100KB bundle impact); XLSX is complex binary format | CSV + UTF-8 BOM opens fine in Excel; document how to open |
| PDF export | "Professional" | Large dependency (jsPDF, html2canvas); PDF is not analyzable data; explicitly out of scope in PROJECT.md | Deferred to v2.0 |
| Scheduled / automatic export | "Convenience" | Requires background service — out of scope for client-only app | Manual button only |
| Import CSV (round-trip) | "Complete workflow" | Entirely different feature; no import target in MSW mock | Out of scope |

#### CSV Column Specification

```
Ngày,Tài khoản,Mô tả,Số tiền,Loại,Danh mục,Trạng thái
2026-02-15,VCB,"GRAB*FOOD123",-85000,Chi tiêu,Ăn uống,Đã ghi sổ
```

| Column | Value | Notes |
|---|---|---|
| Ngày | ISO date `YYYY-MM-DD` | Sorts correctly in Excel without locale issues |
| Tài khoản | Account name string | Quoted if contains comma |
| Mô tả | Merchant / description text | Always quoted to handle commas in names |
| Số tiền | Raw integer, negative for debits | Negative = debit matches Vietnamese banking convention |
| Loại | "Thu nhập" or "Chi tiêu" | Derived from transaction type field |
| Danh mục | Vietnamese category name | Blank for income rows |
| Trạng thái | "Đã ghi sổ" or "Đang xử lý" | Posted / pending |

#### Edge Cases

- **Commas in merchant names:** Wrap ALL text fields in double quotes — do not selectively quote.
- **Quotes within merchant names:** Escape as `""` per RFC 4180.
- **Empty filter result (0 transactions):** Disable export button when list is empty; show tooltip "Không có giao dịch để xuất".
- **Large exports (500+ transactions):** Client-side Blob is fine up to ~50MB; personal finance scale will never hit this limit. No batching needed.
- **iOS Safari download:** May open in new tab instead of downloading. Known browser limitation — document: "Nhấn giữ và chọn Lưu" for iOS users. Not a bug to fix.
- **Special characters in filename:** Replace spaces and Vietnamese diacritics with hyphens in the generated filename to prevent browser encoding issues.

---

### v1.1 Feature Dependencies

```
Transaction Categories (feature 1)
    └──enables──> Budget Tracking (feature 2)
                      └──enables──> Budget column in CSV Export (feature 5)

Transaction Categories (feature 1)
    └──enhances──> CSV Export (feature 5)  [category column in export]

Transaction Categories (feature 1)
    └──enhances──> Chatbot starters (feature 4)  [category context in prompts]

Month-over-Month (feature 3)
    └──enhances──> Chatbot starters (feature 4)  [starter: compare this month vs last]

[Chatbot UX Polish] ──fully independent of──> [Categories, Budget, MoM, CSV]
[Month-over-Month]  ──fully independent of──> [Categories, Budget, Chatbot, CSV]
```

#### Dependency Notes

- **Categories must be built before Budget Tracking:** Budget groups spending by category. Without categories, there is nothing to budget against. This is the only hard dependency in v1.1.
- **CSV Export soft-depends on Categories:** Category column in export is only meaningful if categories exist. Can ship without categories but column will show "Khác" for all rows — acceptable.
- **Month-over-month is fully independent:** Uses existing transaction data and dashboard state. Can be built in any order.
- **Chatbot polish is fully independent:** Pure UI work on the existing chat component. No data dependencies.

---

### v1.1 Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Build Order | Priority |
|---------|------------|---------------------|-------------|----------|
| Transaction Categories | HIGH | MEDIUM | 1st (enables budget) | P1 |
| Budget Tracking | HIGH | LOW | 2nd (requires categories) | P1 |
| Month-over-Month | MEDIUM | LOW | Any order | P1 |
| Chatbot UX Polish | MEDIUM | LOW | Any order | P1 |
| CSV Export | MEDIUM | LOW | After categories | P1 |

All five features are P1 for v1.1. Categories is the only MEDIUM complexity item and is the unblocking dependency — build it first.

---

### Vietnamese User Context

| Consideration | Impact | Implementation Note |
|---|---|---|
| Windows + Excel = primary spreadsheet tool | CSV BOM is not optional | Always prepend `\uFEFF` — critical |
| VND amounts are large integers | No decimal confusion; format as whole numbers | `đ 1.500.000` for display, raw integer for CSV |
| Monthly billing cycle mental model | Users think month-by-month for budgets | All budgets and comparisons default to calendar month |
| Cash still common (not in app data) | App only shows digital transactions | Do not claim "total spending" — say "chi tiêu qua tài khoản" |
| Vietnamese app convention: emoji category icons | Money Lover, Money Keeper both use emoji icons | Match local app conventions for instant familiarity |
| Vietnamese merchant names in transaction data | Some merchants use Vietnamese or mixed scripts | Merchant rule matching must be case-insensitive |
| Users familiar with Money Lover / Money Keeper | Expectations set by local apps | Fixed 6-category structure matches those apps' simplified mode |

---

### Competitor Feature Analysis (v1.1 context)

| Feature | Money Lover (Vietnam #1) | Mint (US reference, now defunct) | Our Approach |
|---------|--------------------------|----------------------------------|--------------|
| Auto-classify | Rules + ML, learns from corrections | Rules + ML | Rules only (no ML); user override in localStorage |
| Category set | 30+ categories, customizable | 25+ categories | 6 fixed Vietnamese categories + Khác |
| Budget tracking | Monthly per category, visual bar | Monthly per category, visual bar | Monthly per category, dashboard progress widget |
| Month-over-month | Yes, on summary screen | Yes, on trends screen | Inline delta on existing stat cards |
| CSV export | Yes (premium only) | Yes | Free, client-side, UTF-8 BOM |
| Chatbot | No | No | Differentiator — already built in v1.0; polish in v1.1 |

---

### v1.1 MVP Definition

#### Launch With (v1.1)

- [x] Transaction categories (auto-classify + localStorage override) — foundation for budget and export
- [x] Budget tracking (localStorage budgets + dashboard progress bars) — highest user value of the batch
- [x] Month-over-month comparison (delta on stat cards) — quick win, high dashboard visibility
- [x] Chatbot UX polish (conversation starters + copy button + cleaner bubbles) — low cost, high perceived quality
- [x] CSV export (UTF-8 BOM, filtered, Vietnamese headers) — frequently requested, low complexity

#### Add After Validation (v1.2)

- [ ] "Apply override to all same merchant" bulk action — if override fatigue is reported
- [ ] Sparkline trend charts (3-month) — after real API data with history exists
- [ ] Budget rollover option — only if explicitly requested

#### Future Consideration (v2+)

- [ ] Savings goal tracking — separate from budget spending limits
- [ ] PDF export — only if printable format is requested
- [ ] Predictive spending ("you'll exceed budget by end of month") — needs 3+ months of real data
- [ ] Custom category creation — if 6 categories prove insufficient

---

### v1.1 Sources

- [Fintech UX Best Practices 2026 - Eleken](https://www.eleken.co/blog-posts/fintech-ux-best-practices)
- [Personal Finance Apps UX 2025 - G & Co.](https://www.g-co.agency/insights/the-best-ux-design-practices-for-finance-apps)
- [Budget App Design Best Practices - Eleken](https://www.eleken.co/blog-posts/budget-app-design)
- [Prompt Controls in GenAI Chatbots - Nielsen Norman Group](https://www.nngroup.com/articles/prompt-controls-genai/)
- [Vietnamese Personal Finance Market - B-Company](https://b-company.jp/emerging-personal-finance-applications-in-vietnam/)
- [Money Lover Vietnam fintech - FintechNews SG](https://fintechnews.sg/3972/personalfinance/vietnams-personal-finance-app-money-lover-adds-new-features/)
- [Conversation Starters UX - SiteGPT Docs](https://sitegpt.ai/docs/navigating-your-chatbot/customizing-add-quick-prompts)
- [Client-side CSV download - GeeksforGeeks](https://www.geeksforgeeks.org/javascript/how-to-create-and-download-csv-file-in-javascript/)
- [Banking App Design Patterns - UX Paradise Medium](https://medium.com/uxparadise/banking-app-design-10-great-patterns-and-examples-de761af4b216)
- [Fintech Dashboard Design - Merge Rocks](https://merge.rocks/blog/fintech-dashboard-design-or-how-to-make-data-look-pretty)

---

## v1.0 Feature Research (2026-03-02)

*Original research for the v1.0 foundation build — preserved for historical reference.*

### Feature Landscape

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transaction list — bank account | Core purpose of the app | LOW | Date, merchant name, amount, category. Sortable by date descending by default. |
| Transaction list — credit card | Users expect all accounts unified | LOW | Same fields as bank + card identifier. |
| Account balance display | First thing users check when opening any finance app | LOW | Current balance, available balance. Shown prominently on dashboard. |
| Dashboard overview (net worth / totals) | Users want one-glance financial summary | MEDIUM | Total assets, total liabilities, net balance. Income vs spend this period. |
| Date range filter | All finance apps support this | LOW | Preset ranges: today, this week, this month, last month, custom. |
| Transaction search by merchant/description | Users remember "that coffee charge" not the date | LOW | Text search against merchant name and description fields. |
| Filter by account | Users have multiple accounts and need to view each separately | LOW | Dropdown or tab to isolate bank vs. credit card, or specific account. |
| Filter by transaction type (debit/credit) | Users want to see only income OR only expenses | LOW | Toggle: all / income / expense. |
| Credit card statement date display | Statement dates are how CC users organize their debt | MEDIUM | Show current billing cycle: start date, end date, due date. |
| Credit card billing cycle grouping | Transactions grouped by billing cycle — not calendar month | MEDIUM | Each cycle is a "bucket"; current vs previous cycle clearly delineated. |
| Loading state (skeleton / spinner) | External API calls have latency | LOW | Skeleton loading on transaction list rows. |
| Error state (API failure) | Network errors must not produce blank/broken UI | LOW | Friendly error message + retry button. |
| Empty state | New accounts or filtered-to-zero results need explanation | LOW | Don't show an empty table with no explanation. |
| Responsive layout | Users check finances on mobile | MEDIUM | Mobile-first for transaction lists; dashboard grid collapses gracefully. |
| Amount formatting | Currency display expected to be correct | LOW | Negative amounts in red, positive in green. VND: `đ 1.500.000` |
| Transaction date formatting | Relative dates improve scannability | LOW | "Today", "Yesterday", absolute for older. |

#### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Billing cycle summary card | Total spend this cycle + days until statement date | MEDIUM | Most dashboards show calendar-month; CC cycle spend is distinctly useful. |
| Spend vs. previous cycle comparison | "You spent 12% more than last billing cycle" | MEDIUM | Requires two billing periods of data. |
| Category breakdown chart (current cycle) | Pie/donut chart of spending by category | MEDIUM | Recharts makes this straightforward. |
| Running balance display | Balance after each transaction | MEDIUM | Useful for "where did my money go." |
| Sticky/pinned account summary | Account balance + billing cycle stays visible while scrolling | LOW | CSS position:sticky; high UX value for low cost. |
| Pagination with "load more" | Infinite-scroll prevents overwhelming initial load | LOW | Better UX than hard pagination. |
| Highlight upcoming statement date | "Statement closes in 3 days" in billing cycle header | LOW | Nudges users to review before statement closes. |

#### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Budget creation / tracking | Natural desire | Requires persistent state, full data model, scope-creeps the read-only premise | Defer to v1.1 (now implemented) |
| Notifications / alerts | Proactive awareness | Requires push infrastructure, background polling | Show balance prominently; let user check dashboard |
| Manual transaction entry | Add cash transactions | Two-source-of-truth problem; significant complexity | Out of scope |
| Real-time WebSocket updates | Modern feel | Bank APIs are batch; WebSocket adds infrastructure with no actual latency benefit | Poll on page load + manual refresh |
| Multi-user / sharing | "Share with spouse" | Requires auth, data isolation, permissions — entire backend | Single-user; out of scope |

---

### Feature Dependencies (v1.0)

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

[Category Breakdown Chart]
    └──requires──> [Transaction List (with category field)]
    └──requires──> [Charting library (Recharts)]
```

---

### v1.0 MVP Definition

All v1.0 features were shipped 2026-03-04. See PROJECT.md Validated section for full list.

---

### v1.0 Competitor Analysis

| Feature | Mint (defunct) | Monarch Money | Copilot (iOS) | Our Approach |
|---------|---------------|---------------|---------------|--------------|
| Transaction list | All accounts unified, calendar-month grouping | Unified list, flexible grouping | Per-account + unified, good search | Unified list; CC grouped by billing cycle (not calendar month) |
| Dashboard | Net worth, account balances, budget status | Net worth, cashflow summary | Spending summary, account balances | Balances + income/expense totals per period |
| CC billing cycle | Calendar-month only (major complaint) | Calendar-month by default | Billing cycle aware | Billing cycle as primary grouping — core differentiator |
| Filtering | Date, category, merchant, account | Date, category, account, tags | Date, category, merchant | Date + account + type + text search |

**Key differentiation (v1.0):** Most aggregators grouped credit card transactions by calendar month. This misaligned with how CC users actually think — billing cycles don't start on the 1st. Grouping by billing cycle is the core differentiator.

---

### Critical Feature Risk (v1.0 — Resolved)

Billing cycle data availability from the third-party API was flagged as a risk. Resolved: billing cycle boundary is implemented as UTC constant (17:00 UTC = midnight Vietnam UTC+7). See PROJECT.md key decisions.

---

### v1.0 Sources

- Industry analysis: Mint, YNAB, Monarch Money, Copilot, Personal Capital/Empower — MEDIUM confidence (training data, patterns stable as of August 2025)
- Plaid API transaction and liabilities data model — MEDIUM confidence (training data)
- Standard banking app UX patterns (Chase, Bank of America, Wells Fargo mobile) — MEDIUM confidence (training data)
- PROJECT.md requirements and constraints — HIGH confidence (authoritative project source)

---

*Feature research for: Personal Finance Dashboard — bank + credit card transactions*
*v1.0 researched: 2026-03-02 | v1.1 updated: 2026-03-08*
