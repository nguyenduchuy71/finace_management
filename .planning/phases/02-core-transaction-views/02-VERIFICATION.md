---
phase: 02-core-transaction-views
verified: 2026-03-03T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Open app, navigate to /accounts — bank transaction list loads with real data"
    expected: "Account tabs appear (VCB, TCB), selecting a tab loads that account's transactions with date/description/VND amount and income/expense icons"
    why_human: "Requires browser with MSW worker running; cannot verify rendering or data display programmatically"
  - test: "Use SearchInput on BankAccountsPage — type a merchant name"
    expected: "After ~350ms debounce delay, transaction list filters to matching results; clearing the X button resets to all transactions"
    why_human: "Debounce timing and reactive filtering requires live interaction"
  - test: "Use DateRangePicker — click calendar to select a date range"
    expected: "Popover opens, calendar shows in range mode, selecting two dates filters transactions and closes popover; X button clears range"
    why_human: "Calendar interaction and Popover close behavior require browser testing"
  - test: "Use TransactionTypeFilter dropdown — select 'Chi tieu' (expense)"
    expected: "Transaction list filters to only expense transactions; switching to 'Thu nhap' shows only income; 'Tat ca' restores all"
    why_human: "Select dropdown interaction requires browser"
  - test: "Click 'Xem them' (Load More) button when displayed"
    expected: "Next page of transactions appends below existing list; button disappears when all transactions loaded; 'Da hien thi tat ca N giao dich' message appears"
    why_human: "Infinite scroll pagination requires live network/MSW interaction"
  - test: "Switch between bank accounts via tabs"
    expected: "Selecting a different account tab loads that account's transactions; active filter state persists across tab switches"
    why_human: "Zustand state persistence across account switches requires live session"
  - test: "Navigate to /credit-cards — credit card list loads"
    expected: "CreditCardTabs shows TCB Visa and VPBank Mastercard; transactions show merchantName, date, VND amount, pending/posted badge"
    why_human: "Requires browser rendering verification of Badge component and status display"
  - test: "Click the floating chat button (bottom-right)"
    expected: "Chat panel opens as bottom sheet on mobile or 380x520px side panel on desktop; settings icon shows API config form; sending message without config shows Vietnamese error prompt"
    why_human: "Floating FAB, responsive panel layout, and chat UX require browser testing"
  - test: "Dark mode toggle in header"
    expected: "Clicking Moon/Sun icon toggles dark mode immediately; theme persists on page refresh; no flash of unstyled content on reload"
    why_human: "Visual theme application and FOUC prevention require browser observation"
---

# Phase 02: Core Transaction Views Verification Report

**Phase Goal:** Implement complete transaction viewing experience with filtering, account/card switching, and conversational AI assistant. All 5 plans must deliver working UI components wired to the data layer.

**Verified:** 2026-03-03
**Status:** HUMAN_NEEDED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view bank account transactions (BANK-01) | VERIFIED | `TransactionList.tsx` uses `useTransactions()` (useInfiniteQuery), flattens `data.pages.flatMap(page => page.data)`, renders `TransactionRow` for each item |
| 2 | Each bank transaction shows date, description, VND amount with income/expense coloring (BANK-02) | VERIFIED | `TransactionRow.tsx`: `formatDisplayDate`, `formatVND`, `isIncome` conditional coloring, `ArrowDownLeft`/`ArrowUpRight` icons, `+`/`–` prefix |
| 3 | User can switch between bank accounts (BANK-03) | VERIFIED | `AccountTabs.tsx` renders shadcn Tabs from `useAccounts()`, calls `setAccountId` on change; `accountId` is in `useTransactions` queryKey — tab switch triggers new fetch |
| 4 | Pagination supports large transaction lists (BANK-04) | VERIFIED | `TransactionList.tsx`: `hasNextPage` guard + "Xem thêm" button calling `fetchNextPage()`; cursor-based MSW handler in `handlers.ts` |
| 5 | User can view credit card transactions (CC-01) | VERIFIED | `CreditCardTransactionList.tsx` uses `useCreditCardTransactions()` (useInfiniteQuery), all async states handled, Load More button present |
| 6 | CC transactions show merchant, date, amount, pending/posted status (CC-02) | VERIFIED | `CreditCardTransactionRow.tsx`: `tx.merchantName`, `formatDisplayDate`, `formatVND`, `Badge` with `isPending` status in Vietnamese |
| 7 | User can filter by date range (FILTER-01) | VERIFIED | `DateRangePicker.tsx`: shadcn Calendar `mode="range"` inside Popover, wired to `setDateRange`; MSW handler filters `transactionDate >= dateFrom` |
| 8 | User can filter by account/card (FILTER-02) | VERIFIED | `AccountTabs` calls `setAccountId`; `CreditCardTabs` calls `setCardId`; both IDs are in respective query keys, triggering re-fetch |
| 9 | User can filter by transaction type income/expense (FILTER-03) | VERIFIED | `TransactionTypeFilter.tsx`: shadcn Select with 3 options wired to `setTxType`; MSW handler filters by `txType` param |
| 10 | User can search transactions by text (FILTER-04) | VERIFIED | `SearchInput.tsx`: 350ms debounce via `useDebounced`, wired to `setSearchQuery`; MSW handler matches `description`/`merchantName` |
| 11 | All async states handled: loading skeleton, error, empty (DASH-03) | VERIFIED | Both list components: `isLoading` → Skeleton, `isError` → AlertCircle error state, empty array → `TransactionEmptyState` with `hasFilters` prop |

**Score: 11/11 truths verified**

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/useTransactions.ts` | useInfiniteQuery for bank transactions | VERIFIED | 24 lines, useInfiniteQuery with accountId + all filter params in queryKey |
| `src/hooks/useCreditCardTransactions.ts` | useInfiniteQuery for CC transactions | VERIFIED | 36 lines, same cursor pattern, cardId in queryKey |
| `src/hooks/useAccounts.ts` | Account list query | VERIFIED | 9 lines, useQuery wrapping getAccounts |
| `src/hooks/useCreditCards.ts` | Credit card list query | VERIFIED | 9 lines, useQuery wrapping getCreditCards |
| `src/hooks/useDebounced.ts` | Debounce utility | VERIFIED | 14 lines, setTimeout/clearTimeout cleanup |
| `src/mocks/handlers.ts` | Server-side filter simulation | VERIFIED | 115 lines, filters: search, dateFrom, dateTo, txType for both endpoints |
| `src/services/accounts.ts` | TransactionFilters interface + forwarding | VERIFIED | 40 lines, TransactionFilters interface, all 4 params forwarded |
| `src/services/creditCards.ts` | CC service with filter forwarding | VERIFIED | 34 lines, imports TransactionFilters, forwards all params |
| `src/stores/themeStore.ts` | Dark mode with localStorage persistence | VERIFIED | 42 lines, applies `dark` class to documentElement immediately on load |
| `src/stores/chatStore.ts` | Chat state + API config persistence | VERIFIED | 82 lines, isOpen, messages, apiConfig (localStorage), showSettings |
| `src/components/layout/AppHeader.tsx` | Navigation + theme toggle | VERIFIED | 63 lines, NavLink with isActive styling, Sun/Moon icons, min-h-[44px] |
| `src/components/layout/AppShell.tsx` | Layout wrapper with chat integration | VERIFIED | 18 lines, Outlet + ChatButton + ChatPanel |
| `src/pages/BankAccountsPage.tsx` | Bank page composition | VERIFIED | 25 lines, AccountTabs + FilterBar + TransactionList — no stub text |
| `src/pages/CreditCardsPage.tsx` | Credit card page composition | VERIFIED | 25 lines, CreditCardTabs + FilterBar + CreditCardTransactionList — no stub text |
| `src/App.tsx` | Routing with AppShell layout | VERIFIED | 36 lines, Routes/Route/Navigate, / redirects to /accounts |
| `src/features/accounts/AccountTabs.tsx` | Account switcher (BANK-03, FILTER-02) | VERIFIED | 60 lines, useAccounts, setAccountId, useEffect init to first account |
| `src/features/creditCards/CreditCardTabs.tsx` | Card switcher (FILTER-02) | VERIFIED | 49 lines, useCreditCards, setCardId, useEffect init to first card |
| `src/features/transactions/TransactionRow.tsx` | Bank transaction row (BANK-02) | VERIFIED | 52 lines, income/expense coloring, icons, formatVND, formatDisplayDate, dark: classes |
| `src/features/transactions/TransactionList.tsx` | Bank transaction list (BANK-01, BANK-04, DASH-03) | VERIFIED | 63 lines, useTransactions, all async states, Load More, flatMap pages |
| `src/features/transactions/TransactionListSkeleton.tsx` | Loading skeleton (DASH-03) | VERIFIED | 21 lines, Skeleton rows |
| `src/features/transactions/TransactionEmptyState.tsx` | Empty state (DASH-03) | VERIFIED | 19 lines, hasFilters prop switches Vietnamese message |
| `src/features/creditCards/CreditCardTransactionRow.tsx` | CC transaction row (CC-02) | VERIFIED | 41 lines, Badge with pending/posted, VND amount, dark: classes |
| `src/features/creditCards/CreditCardTransactionList.tsx` | CC transaction list (CC-01, DASH-03) | VERIFIED | 77 lines, useCreditCardTransactions, all async states, Load More |
| `src/features/creditCards/CreditCardTransactionListSkeleton.tsx` | CC loading skeleton (DASH-03) | VERIFIED | 22 lines, Skeleton rows with badge placeholder |
| `src/components/filters/SearchInput.tsx` | Text search with debounce (FILTER-04) | VERIFIED | 42 lines, useDebounced(local, 350), setSearchQuery on debounced value |
| `src/components/filters/DateRangePicker.tsx` | Date range filter (FILTER-01) | VERIFIED | 78 lines, Calendar mode=range, Popover, setDateRange wired |
| `src/components/filters/TransactionTypeFilter.tsx` | Type filter (FILTER-03) | VERIFIED | 26 lines, Select with 3 options, setTxType wired |
| `src/components/filters/FilterBar.tsx` | Filter bar composition | VERIFIED | 35 lines, composes SearchInput + DateRangePicker + TransactionTypeFilter + conditional Clear button |
| `src/features/chatbot/useChatApi.ts` | API integration hook | VERIFIED | 91 lines, fetch to configured endpoint, 20-item context, error handling |
| `src/features/chatbot/ChatButton.tsx` | Floating FAB | VERIFIED | 22 lines, fixed bottom-right, MessageCircle/X icon toggle |
| `src/features/chatbot/ChatPanel.tsx` | Chat UI panel | VERIFIED | 89 lines, mobile bottom sheet (max-h-85vh) + desktop sm:w-[380px] |
| `src/features/chatbot/ChatMessage.tsx` | Message bubbles | VERIFIED | 55 lines, user/assistant/error roles styled differently |
| `src/features/chatbot/ChatInput.tsx` | Chat input with Enter-to-send | VERIFIED | 50 lines, Enter sends, Shift+Enter newline, disabled when loading |
| `src/features/chatbot/ChatSettings.tsx` | API config form | VERIFIED | 105 lines, endpoint URL + password input with show/hide, saves via setApiConfig |
| shadcn components (card, badge, button, input, select, skeleton, tabs, popover, calendar) | UI primitives | VERIFIED | All 9 components present in src/components/ui/ with substantive content |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AccountTabs` | `filterStore.accountId` | `setAccountId` | WIRED | useEffect initializes; onValueChange calls setAccountId |
| `filterStore.accountId` | `useTransactions` query | `queryKey` includes accountId | WIRED | `queryKey: ['transactions', accountId, {...}]` — tab change = new fetch |
| `useTransactions` | `getTransactions` service | `queryFn` calls with filters | WIRED | All 4 filter params forwarded from store |
| `getTransactions` | MSW handler | `/api/accounts/:accountId/transactions` | WIRED | Handler reads search/dateFrom/dateTo/txType searchParams |
| `TransactionList` | `useTransactions` | `useTransactions()` call | WIRED | `data.pages.flatMap` + fetchNextPage + hasNextPage |
| `SearchInput` | `filterStore.searchQuery` | `useDebounced` + `setSearchQuery` | WIRED | 350ms delay, then setSearchQuery called in useEffect |
| `DateRangePicker` | `filterStore.dateFrom/dateTo` | `setDateRange` | WIRED | Calendar onSelect calls setDateRange immediately |
| `TransactionTypeFilter` | `filterStore.txType` | `setTxType` via onValueChange | WIRED | Select onChange directly wired |
| `FilterBar` | all filter components | composition + `resetFilters` | WIRED | Renders all 3 filters, conditional Clear button calls resetFilters |
| `CreditCardTabs` | `filterStore.cardId` | `setCardId` | WIRED | useEffect init + onValueChange |
| `filterStore.cardId` | `useCreditCardTransactions` | `queryKey` includes cardId | WIRED | `queryKey: ['creditCardTransactions', cardId, {...}]` |
| `ChatButton` | `chatStore.isOpen` | `toggleChat` | WIRED | onClick={toggleChat}, icon switches on isOpen |
| `ChatPanel` | `chatStore` | `isOpen`, `messages`, `showSettings` | WIRED | Returns null when !isOpen; renders messages list |
| `useChatApi` | `filterStore` | reads searchQuery/dateFrom/dateTo/txType/accountId | WIRED | useShallow selector reads all filter state for context |
| `useChatApi` | `useTransactions` data | `visibleTransactions.slice(0, 20)` | WIRED | Builds context string from current visible transactions |
| `AppShell` | `ChatButton` + `ChatPanel` | direct render after `<main>` | WIRED | Both imported and rendered in AppShell |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BANK-01 | 02-03 | View all bank account transactions | SATISFIED | TransactionList + useInfiniteQuery renders all pages |
| BANK-02 | 02-03 | Each transaction shows date, description, amount, type | SATISFIED | TransactionRow: formatDisplayDate, merchantName/description, formatVND, income/expense icons |
| BANK-03 | 02-04 | Switch between bank accounts | SATISFIED | AccountTabs + setAccountId in queryKey |
| BANK-04 | 02-03 | Pagination for large lists | SATISFIED | Load More button, cursor pagination in MSW |
| CC-01 | 02-03 | View credit card transaction list | SATISFIED | CreditCardTransactionList + useCreditCardTransactions |
| CC-02 | 02-03 | CC transactions show date, merchant, amount, pending/posted | SATISFIED | CreditCardTransactionRow with Badge component |
| FILTER-01 | 02-03 | Date range picker | SATISFIED | DateRangePicker with shadcn Calendar range mode |
| FILTER-02 | 02-04 | Filter by account/card | SATISFIED | AccountTabs + CreditCardTabs set IDs in queryKey |
| FILTER-03 | 02-03 | Filter by transaction type | SATISFIED | TransactionTypeFilter Select with 3 options |
| FILTER-04 | 02-03 | Text search with debounce | SATISFIED | SearchInput with useDebounced(350ms) |
| DASH-03 | 02-01 | All async states: loading, error, empty | SATISFIED | Both list components handle all 3 states with proper components |

**Note:** REQUIREMENTS.md checklist still shows some IDs as "Pending" (`[ ]` not `[x]`). This is a documentation staleness issue — the REQUIREMENTS.md tracking table was not updated to mark these as Complete after implementation. The code fully satisfies all 11 requirements. This is a docs gap, not an implementation gap.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `AccountTabs.tsx:37` | `return null` when accounts.length === 0 | Info | Correct behavior — no accounts = nothing to render |
| `ChatPanel.tsx:20` | `if (!isOpen) return null` | Info | Correct behavior — panel is hidden when chat is closed |
| `CreditCardTabs.tsx:31` | `return null` when cards.length === 0 | Info | Correct behavior — no cards = nothing to render |
| `chatStore.ts:35,38` | `return null` in loadApiConfig try/catch | Info | Correct error handling for JSON parse failure |
| Various | `placeholder=` attribute text | Info | HTML input placeholder attributes — not implementation stubs |

**No blocking anti-patterns found.** All `return null` instances are intentional conditional renders, not stubs.

---

### Human Verification Required

#### 1. Bank Transaction List Rendering

**Test:** Navigate to `/accounts` in a browser with the dev server running
**Expected:** VCB and TCB account tabs appear; selecting each tab loads that account's transactions showing date, merchant name, VND amount with green (income) / red (expense) coloring and directional arrow icons
**Why human:** Requires browser + MSW service worker + React rendering verification

#### 2. Search Debounce Behavior

**Test:** Type a merchant name in the search box on BankAccountsPage
**Expected:** The transaction list does NOT filter on every keystroke — it waits ~350ms after the user stops typing before filtering. The X clear button resets the list to all transactions.
**Why human:** Timing behavior of debounce cannot be verified statically

#### 3. Date Range Picker UX

**Test:** Click the date range picker button; select a start date then an end date
**Expected:** Calendar opens in range mode (highlights range between dates); after selecting both dates the popover auto-closes and the button label shows the formatted range (e.g. "01/01/26 – 31/01/26"); clicking X clears the range
**Why human:** Calendar interaction and popover close-on-complete-range behavior require live testing

#### 4. Infinite Scroll / Load More

**Test:** On BankAccountsPage with no filters active (all 38 VCB transactions visible), check if "Xem thêm" button appears (MSW returns 20 items per page)
**Expected:** First 20 transactions load; "Xem thêm" button appears; clicking loads next 18; button disappears; "Đã hiển thị tất cả 38 giao dịch" message appears
**Why human:** Requires live MSW pagination interaction

#### 5. Account Switching State Persistence

**Test:** On BankAccountsPage, type a search query, then switch to a different account tab
**Expected:** The search query persists in the SearchInput box; the transaction list re-fetches for the new account using the same search filter
**Why human:** Zustand state persistence across navigation requires live session testing

#### 6. Credit Card Badge Display

**Test:** Navigate to `/credit-cards` and view the transaction list
**Expected:** Each row shows merchantName, date, VND amount (always shown as expense/red), and a shadcn Badge showing "Chờ xử lý" (pending) or "Đã hạch toán" (posted) with appropriate visual styling
**Why human:** Visual badge rendering requires browser verification

#### 7. Chat Panel Responsive Layout

**Test:** Open the chat panel (floating button) on both mobile viewport and desktop
**Expected:** Mobile: full-width bottom sheet anchored to bottom edge, max 85% viewport height; Desktop: 380×520px fixed panel at bottom-right corner
**Why human:** Responsive CSS breakpoints require visual inspection at different viewport sizes

#### 8. Chat API Config and Error Handling

**Test:** Open chat panel, click Settings icon, leave fields empty and try sending a message
**Expected:** Vietnamese error message appears: "Chưa cấu hình API. Nhấn biểu tượng cài đặt để nhập endpoint và API key." — no crash, graceful degradation
**Why human:** UI interaction flow and Vietnamese error message display require live testing

#### 9. Dark Mode FOUC Prevention

**Test:** Enable dark mode, refresh the page
**Expected:** Page loads dark immediately — no visible flash of light-mode content before dark class is applied
**Why human:** Flash of unstyled content is a timing issue requiring visual observation on page load

---

## Summary

**All 11 observable truths are verified.** All 35 required artifacts exist with substantive implementations (not stubs). All 16 key links are confirmed wired. All 11 requirement IDs (BANK-01 through BANK-04, CC-01 through CC-02, FILTER-01 through FILTER-04, DASH-03) have implementation evidence in the codebase. TypeScript compiles with zero errors (`npx tsc --noEmit` exits clean).

The status is **HUMAN_NEEDED** rather than PASSED because the phase goal includes "working UI components wired to the data layer" — this requires browser-level verification that the filtering, account switching, infinite scroll, dark mode, and chat panel all function as designed. The automated checks verify all the code exists and is correctly wired, but cannot substitute for a live browser session.

**The phase is ready for human sign-off.** No gaps were found.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
