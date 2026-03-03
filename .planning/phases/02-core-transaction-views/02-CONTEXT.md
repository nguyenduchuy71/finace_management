# Phase 2: Core Transaction Views - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** User discussion — scope expanded to include chatbot + UI improvements

---

## Phase Boundary

Phase 2 delivers the full transaction viewing experience PLUS a conversational finance assistant, with improved visual design and mobile-first responsiveness.

Users can:
- Browse all bank and credit card transactions with rich filtering and search
- Chat with an AI bot for transaction analysis and budget advice (custom API, user-supplied API key)
- Access the app on mobile with dark mode option and polished visual design

---

## Implementation Decisions

### Core Transaction Views (Original Scope)

- **Pagination:** Use TanStack Query `useInfiniteQuery` with cursor-based pagination (MSW returns `nextCursor`)
- **Filtering:** Date range, account/card, transaction type, text search all wired to Zustand store and queryKey
- **Components:** TransactionList, TransactionRow, CreditCardTransactionRow with status badges, loading skeletons, error states, empty states
- **Account Switching:** Tabs (AccountTabs, CreditCardTabs) for selecting which bank account or credit card to view

### Chatbot Feature (NEW)

- **UI Pattern:** Floating toggle button (corner of screen) → opens/closes modal or slide-out drawer
- **API Integration:** Custom endpoint (user provides endpoint + API key during setup)
- **Model Context:** Bot can analyze current filtered transactions and give budget insights
- **Capabilities:**
  - Analyze transactions: "What are my top spending categories this month?"
  - Budget advice: "How can I reduce spending in this category?"
  - General Q&A about the transactions displayed
- **API Key Storage:** User enters API key in settings panel (stored in localStorage, shown as masked in UI)
- **Error Handling:** Graceful degradation if API fails, error message in chat

### Dark Mode (NEW)

- **Implementation:** Zustand store for theme (light/dark) + localStorage persistence
- **Tailwind:** Use `dark:` prefix classes; theme toggle button in header
- **Components Affected:** All existing components use `dark:bg-slate-950 dark:text-slate-50` patterns
- **Default:** Light mode on first visit, persists user choice

### Mobile Optimization (NEW)

- **Breakpoints:** Mobile-first Tailwind (sm: 640px, md: 768px, lg: 1024px)
- **Chat Drawer:** Full-height on mobile, side panel on desktop
- **Transaction Lists:** Vertical stack on mobile, scrollable cards; horizontal layout on desktop
- **Touch Targets:** All buttons/inputs min 44px for mobile usability
- **Responsive Typography:** Smaller heading sizes on mobile

### Visual Design Improvements (NEW)

- **Color Palette:** Refined Tailwind colors (consistent accent color for actions)
- **Spacing:** Consistent padding/margin grid (4px increments via Tailwind)
- **Typography:** Better font hierarchy (heading weights, letter-spacing, line-height)
- **Shadows & Depth:** Use Tailwind `shadow-sm` / `shadow-md` for component separation
- **Icons:** Consistent Lucide React icon sizing and colors

---

## Claude's Discretion

- **Chat History:** Whether to persist chat history per session or clear each time (recommendation: clear on page refresh, no localStorage)
- **Debounce Timing:** Search input debounce delay (recommendation: 350ms as in original Phase 1 research)
- **Mobile Drawer Size:** Percentage of screen occupied by chat drawer on mobile (recommendation: 85% height on mobile)
- **Dark Mode Detection:** Whether to detect system preference on first visit (recommendation: no auto-detect, user manual toggle)
- **Chat Button Positioning:** Exact placement of floating toggle button (recommendation: bottom-right corner, padding 16px)

---

## Specific Ideas

- Chat toggle button: Floating circle with Lucide `MessageCircle` icon, positioned `bottom-right`, z-index high
- Chat modal: Use shadcn `Dialog` component for desktop, `Drawer` component for mobile
- API key input: Password-type input in Settings page, masked display with show/hide toggle
- Transaction data passed to bot: Current filtered list (date range, account, type) so bot gives contextual analysis
- Dark mode toggle: Header icon button with `Sun` / `Moon` Lucide icons, smooth transition

---

## Deferred Ideas

- Real-time chat suggestions (Type-ahead for common questions) — v2
- Multi-turn conversation memory (persist chat across sessions) — v2
- Integration with real banking API (currently mock data only) — v2
- Advanced charting for chat context (show spending trends inline with chat) — v2
- Voice input/output for chat — v2

---

*Phase: 02-core-transaction-views*
*Context gathered: 2026-03-03 via user discussion*
