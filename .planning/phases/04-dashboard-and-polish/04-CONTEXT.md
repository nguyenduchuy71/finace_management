# Phase 4: Dashboard and Polish - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard and responsive polish phase delivers a one-glance financial summary dashboard where users can see their total income and expenses, visualize category breakdown with interactive charts, and filter by time period. The application becomes fully usable on 375px mobile screens with no horizontal overflow, accessible tap targets, and touch-optimized interactions. Charts do not re-render or re-animate when non-relevant filters change.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Placement & Layout
- **Location:** Dedicated DashboardPage (separate route, not a tab)
- **Main layout:** Three-column design on desktop: Income card | Expenses card | Chart
- **Period selector:** Prominent date range picker at the top of the page (allows any custom date range)
- **Stats cards:** Modern large cards with icon + big number + label (using shadcn Card component with icon accents)
- **Optional net total:** Toggleable in settings to show net income/savings (income - expenses)
- **Mobile layout:** Responsive stacking - Income → Expenses → Chart vertically on 375px screens; preserve three-column on wider screens

### Chart Design & Interactions
- **Chart type toggle:** Users can switch between donut and bar chart representations
- **Categories displayed:** Show all transaction categories (no "Top 6 + Other" limit)
- **Chart interactions (Desktop):** Standard Recharts hover tooltips showing category name, amount, and percentage
- **Chart interactions (Mobile):** Tap a chart segment to show/hide its tooltip (more natural than hover on touch)
- **Chart responsiveness:** On mobile, chart scales proportionally to fit screen width; donut/bar maintains readability
- **Empty state:** Show "No data available for this period" message when selected period has no transactions
- **Pending transactions included:** Dashboard totals and chart include both pending and posted credit card transactions (full financial picture)
- **Pending in chart:** Chart breakdown includes pending transactions in category percentages

### Data Aggregation & Filtering
- **Data sources:** Combine bank accounts and credit card transactions in single total and chart (Claude's decision: cleaner overall view, not separated by source)
- **Chart categories source:** Single unified chart showing categories from all account types together (Claude's decision: better visual clarity than side-by-side charts)
- **Filter linking:** Dashboard uses independent date picker (Claude's decision: users can compare dashboard period to current transaction list period without switching views)
- **Other filters (account, type) impact:** Dashboard respects account and transaction type filters (if user filters to "Income only", dashboard updates accordingly)
- **Re-render optimization:** Dashboard memoizes stats and chart to prevent re-renders when non-relevant filters change (e.g., search text change doesn't re-animate chart). Only date range or included transactions trigger re-render
- **Additional sections:** Claude's decision: show bank vs credit card subtotals as secondary info (helps users understand contribution by source without cluttering primary totals)

### Mobile & Responsive Behavior
- **Navigation to Dashboard:** Menu/Sidebar access (not a bottom tab), since mobile space is limited
- **Loading state:** Show skeleton loaders for stat cards and chart while data fetches (better UX than plain "Loading..." text)
- **Font sizing:** Responsive typography - larger stat numbers on mobile for readability, scale down on desktop
- **Spacing:** Appropriate padding/margins chosen per breakpoint (Claude's decision: keep consistency with existing transaction list spacing patterns)
- **Date picker on mobile:** Native date inputs on mobile (type='date'), calendar popup on desktop (better mobile UX)
- **Tap targets:** All interactive elements (date picker, chart, toggles) are ≥48px for comfortable touch
- **No horizontal scroll:** All dashboard content fits within 375px viewport width with proper text wrapping

### Error Handling & Edge Cases
- **API failures:** Show clear error message with retry button (allows users to attempt reload without refreshing page)
- **Partial data:** If some accounts missing from period, show subtle note: "Data from [N] of [M] accounts" so users understand scope
- **Negative values (refunds):** Display as-is with clear visual distinction (Claude's decision: honest accounting, refunds reduce expenses with clear labeling)
- **Zero transactions:** Empty state message invites user to explore transactions or adjust period

### Claude's Discretion
- Exact color scheme for income (green/positive) vs expenses (red/negative)
- Specific icon choices for stat cards
- Chart animation transitions
- Exact responsive breakpoints (mobile/tablet/desktop)
- Skeleton loader design and animation
- Category grouping logic (how to aggregate transaction types into meaningful categories)
- Toast/notification styling for retry feedback

</decisions>

<specifics>
## Specific Ideas

- Dashboard should feel like a financial "at a glance" tool — quick insights without deep drilling
- Charts should use Recharts (already in project, supports both donut and bar)
- Reuse existing shadcn Card, Button, Popover, Calendar components where possible
- Mobile dashboard experience should mirror the simplicity of the transactions list (clean, focused)
- Period selection should be flexible (date picker) to allow custom analysis windows (not locked to calendar months)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui Card component** — Use for stat totals (income/expenses), consistent with existing UI
- **shadcn/ui Calendar + Popover** — Use for date range picker (already available)
- **shadcn/ui Badge** — Could indicate urgency or optional net total toggle state
- **Skeleton component** — Use for loading state placeholders
- **Zustand filter store** — Already manages date ranges, can feed dashboard filtering logic
- **TanStack Query hooks** — useTransactions, useCreditCards, useAccounts already fetch data; dashboard can aggregate results

### Established Patterns
- **Data aggregation:** useTransactions hook returns paginated data; dashboard will aggregate across all pages for totals
- **Memoization:** Project uses useMemo (seen in billingCycle utilities); apply same pattern to prevent chart re-renders
- **Zustand selectors:** Use useShallow for filter store subscriptions (existing pattern)
- **Responsive design:** Tailwind CSS with breakpoints already established in transaction list; reuse same breakpoint strategy
- **Loading/error states:** TransactionList has established patterns for skeleton, error, and empty states; follow same UX

### Integration Points
- **Routing:** Add `/dashboard` route; integrate into main navigation (sidebar for mobile, nav bar for desktop)
- **Filter store:** Dashboard reads date range and other filters from existing Zustand store; updates trigger dashboard re-calc
- **Data layer:** Aggregate useTransactions, useCreditCards, useAccounts hook results into summary calculations
- **State export:** Dashboard summary stats could be exported to other features (e.g., home/onboarding card showing quick stats)

</code_context>

<deferred>
## Deferred Ideas

- **Month-over-month comparison & percent change:** Compare spending across months, show growth/decline trends → Phase 5+ (Advanced Analytics)
- **Custom budget targets:** Set spending limits per category, show progress toward budget → Phase 5+ (Budget Planning)
- **Spending insights & alerts:** AI-driven anomaly detection ("Unusual spending this month") → Phase 6+ (Insights)
- **Export/print dashboard:** Generate reports or PDF summaries → Phase 6+ (Reporting)
- **Chatbot integration:** Users can ask questions about their spending ("What did I spend on food?") → Phase 5 (Chatbot)

</deferred>

---

*Phase: 04-dashboard-and-polish*
*Context gathered: 2026-03-04*
