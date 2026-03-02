# Pitfalls Research

**Domain:** Frontend-only personal finance dashboard (React + TypeScript, third-party banking API)
**Researched:** 2026-03-02
**Confidence:** MEDIUM — Based on established web platform specifications (CORS, ECMAScript Intl, browser APIs) and widely-documented patterns in frontend financial application development. WebSearch/WebFetch unavailable during this session; claims rooted in MDN-documented behavior and well-known community patterns. Flagged where single-source.

---

## Critical Pitfalls

### Pitfall 1: Calling Third-Party Banking APIs Directly from the Browser

**What goes wrong:**
The frontend calls the banking/financial API directly from the browser using `fetch()` or `axios`. The API either blocks the request due to CORS policy or — worse — the API has no CORS restrictions and the request succeeds, but only in development. In production, one of three things happens: (a) the API adds CORS restrictions and all requests break, (b) the API key is exposed in browser network tab and is stolen, or (c) the API requires server-side-only authentication flows (OAuth token exchange, signed requests with secrets) that cannot be safely done client-side.

**Why it happens:**
Frontend-only projects start with the assumption "no backend needed." Developers add a mock API, build the full UI, then swap in the real API URL late in the project. At that point, CORS failures and secret exposure are discovered simultaneously with real data, creating pressure to ship insecure workarounds.

**How to avoid:**
- In Phase 1, define a strict API adapter interface (`getBankTransactions()`, `getCreditStatements()`) that decouples UI from transport.
- Use a proxy for the real API — even a minimal Cloudflare Worker, Netlify Function, or Vercel serverless function — that holds the API key server-side and relays authenticated requests. The app remains "frontend-only" in spirit but the secret is never exposed.
- Never put API keys in `.env` files that get bundled into the client build (Vite/CRA bake `VITE_` prefixed vars into the JS bundle — visible to anyone who opens DevTools).
- Test with real CORS headers early: add a `cors-anywhere` proxy locally in development but treat it as a signal that a real proxy is needed.

**Warning signs:**
- API key is stored in `.env.local` with a `VITE_` or `REACT_APP_` prefix.
- `fetch()` calls in component files include `Authorization: Bearer <token>` with a hardcoded or env-injected secret.
- Development works but production returns `CORS policy: No 'Access-Control-Allow-Origin' header`.
- The third-party API documentation says "server-side only" for any endpoint being called.

**Phase to address:** Foundation phase (Phase 1) — define the API adapter layer and proxy strategy before building any real data fetching.

**Confidence:** HIGH — CORS is a browser-enforced specification (RFC 6454 / Fetch Living Standard); API key exposure via bundled env vars is documented behavior of every major bundler.

---

### Pitfall 2: Treating Mock API Data as a Contract

**What goes wrong:**
The mock API is built to match what the developer assumes the real API returns. When the real API is integrated, field names differ (`transaction_date` vs `date`), amounts come as strings not numbers (`"150000"` vs `150000`), negative values use different conventions (credit card debits might be positive or negative depending on the API), and timestamps are in different formats (`ISO 8601` vs Unix epoch vs `DD/MM/YYYY`). Every component that consumed the mock data needs to be rewritten.

**Why it happens:**
Mock data is created before reading the real API documentation carefully. The mock is shaped around the UI's needs, not the API's actual contract. The gap is discovered only when real integration begins.

**How to avoid:**
- Read the real API documentation **first**, even if using mocks for development. Shape mock data to exactly match the real API response schema — same field names, same types, same conventions.
- Define TypeScript interfaces that mirror the real API response, not the UI's ideal shape. Use a separate transformation layer (adapter/mapper) to convert API shape to UI shape.
- If the real API is unknown, document the assumed contract in a `types/api.ts` file and treat any deviation as a breaking change requiring the adapter to be updated, not components.

**Warning signs:**
- Mock data uses camelCase (`transactionDate`) but API docs show snake_case (`transaction_date`).
- Amounts in mock are numbers but API returns string amounts (common in Vietnamese banking APIs to avoid float precision issues).
- Mock credit card transactions have negative amounts for charges; real API may use positive amounts with a `type: "debit"` field.

**Phase to address:** Phase 1 (API integration setup) — write the TypeScript API response types from real docs before building components.

**Confidence:** MEDIUM — Pattern documented in frontend integration post-mortems; specific API conventions vary by provider.

---

### Pitfall 3: Floating-Point Arithmetic on Currency Values

**What goes wrong:**
Transaction amounts are stored and calculated as JavaScript `number` (IEEE 754 floating-point). Summations like `0.1 + 0.2 = 0.30000000000000004` display incorrectly in totals. Dashboard shows "Total spending: 1,500,000.00000001 VND". Worse, filter comparisons (`amount > 500000`) fail for amounts that should be equal due to float drift.

**Why it happens:**
JavaScript's `number` type is a 64-bit float. All arithmetic on it is subject to binary floating-point representation errors. Financial calculations require exact decimal arithmetic. This is rarely encountered with round numbers during development (mock data uses nice round amounts) but surfaces with real transaction data.

**How to avoid:**
- Never perform arithmetic on raw float amounts. Convert to integer "minor units" immediately on receipt (e.g., multiply by 100 for 2-decimal currencies, or treat VND amounts as integers since VND has no subunit).
- For VND (Vietnamese Dong): amounts are already integers — no decimal places needed. Store and sum as integers only.
- For multi-currency: use a library like `dinero.js` or `currency.js` that enforces integer-based arithmetic internally.
- Format for display only at the render layer, never mutate the stored value for display purposes.

**Warning signs:**
- Computed totals show more than 2 decimal places in a currency that has 2 decimal places.
- Subtraction of two seemingly equal amounts produces a non-zero result.
- Amount comparisons in filter logic use `===` on floats received from API.

**Phase to address:** Phase 1 (data layer / TypeScript contracts) — define amount types as integers or use a money library from day one.

**Confidence:** HIGH — IEEE 754 floating-point behavior is a specification-level fact; VND integer-only convention is well-established.

---

### Pitfall 4: Timezone Confusion on Statement Dates and Transaction Timestamps

**What goes wrong:**
Transaction timestamps from the API are in UTC. The app displays them using `new Date(timestamp).toLocaleDateString()` which converts to the browser's local timezone. A transaction posted at `2025-12-31T17:00:00Z` (UTC) is `2026-01-01 00:00:00` in Vietnam (UTC+7) — but the same timestamp displays as `2025-12-31` to a user with their system clock set to UTC. Statement cutoff dates (e.g., "cycle closes on the 15th") are bank-local (Vietnam timezone) and may be stored as date-only strings — but if treated as midnight UTC they shift by 7 hours and transactions at the boundary fall into the wrong statement cycle.

**Why it happens:**
Developers use `new Date()` which parses ISO strings into local time. Mock data uses dates without times (`"2025-12-15"`) which parse as midnight UTC, silently working correctly in UTC environments. The bug only surfaces when tested in a different timezone — often only in production.

**How to avoid:**
- Determine the API's timezone convention in Phase 1 and document it explicitly: "all timestamps are UTC", "all date-only strings are in Asia/Ho_Chi_Minh (UTC+7)".
- For statement cycle boundaries (credit card `ngay_sao_ke`): treat as bank-local dates. Use `date-fns-tz` or `Temporal` API (or Luxon) to parse with explicit timezone rather than relying on `new Date()`.
- Never use `new Date("2025-12-15")` — it parses as midnight UTC, not midnight local. Use `new Date("2025-12-15T00:00:00")` for local midnight, or better, a timezone-aware parser.
- Add a test that runs with system timezone forced to UTC and verifies statement grouping still produces correct Vietnamese dates.

**Warning signs:**
- Transactions dated "Jan 1" appear under "Dec 31" statement cycle, or vice versa.
- `new Date(apiDateString)` used directly without timezone specification.
- Statement cycle filtering works on developer machine but fails in CI (which typically runs in UTC).
- Date-only strings (`"2025-12-15"`) parsed with `new Date()` rather than `parseISO` from `date-fns`.

**Phase to address:** Phase 1 (data model) and Phase 2 (statement cycle display) — establish timezone parsing convention before any date display logic is written.

**Confidence:** HIGH — Date parsing behavior of `new Date()` with ISO strings is specified in ECMAScript; UTC-vs-local timezone behavior is a documented browser platform specification.

---

### Pitfall 5: Fetching All Transactions Without Pagination on First Load

**What goes wrong:**
The app fetches all transactions for all accounts on mount with no pagination. For a user with 2 years of history across 3 accounts and 1 credit card, this may be 2,000–5,000 transactions in a single request. The initial load hangs for several seconds, the transaction list renders 5,000 DOM nodes, scrolling becomes janky at 60fps on mobile, and filtering/search triggers re-renders of 5,000 rows.

**Why it happens:**
Mock data has 20–50 transactions. Performance is not observable during development. The assumption "just load everything and filter client-side" works at mock scale but fails at real scale. Pagination is retrofitted later, which requires significant state management restructuring.

**How to avoid:**
- Design the API adapter interface with pagination from day one: `getTransactions({ page, pageSize, filters })` even if the initial implementation returns all data.
- Use virtualized lists for transaction rendering — `@tanstack/virtual` or `react-window` — so only visible rows are in the DOM regardless of total count.
- Set a hard upper limit on initial fetch (e.g., fetch last 90 days only on first load, provide "load more" or date range picker).
- Implement React Query's `useInfiniteQuery` pattern from the start rather than plain `useEffect` + `useState` for list data.

**Warning signs:**
- Component fetches with no `page` or `limit` parameter.
- Transaction list renders with a direct `.map()` over all items with no virtualization.
- State management stores the full unfiltered list in memory and applies filters as derived state over 1000+ items.
- No loading skeleton/progressive disclosure — app waits for full data before showing anything.

**Phase to address:** Phase 1 (API adapter design) and Phase 2 (transaction list component) — virtualization and pagination shape must be decided before list component architecture is finalized.

**Confidence:** MEDIUM-HIGH — Performance characteristics of large DOM lists and React re-render costs are well-documented; specific thresholds are approximations based on typical device profiles.

---

### Pitfall 6: Overly Complex Global State for What Is Read-Only Data

**What goes wrong:**
The app uses Redux Toolkit (or Zustand with overengineered slices) for all state, including server data. Transaction lists, account balances, and statement data are stored in global state, manually invalidated, and kept in sync with the API by hand. Cache management, loading states, and error states are implemented three times (once per feature slice). When a filter changes, the developer writes a thunk that re-fetches, dispatches loading, dispatches success, updates normalized entity maps, and triggers selector memoization. This is 400 lines of boilerplate for a read-only dashboard.

**Why it happens:**
Redux/Zustand is the first thing added to any React project by habit. Server data and client UI state are conflated into one global store. The developer doesn't distinguish between "server state" (data from API, needs caching and sync) and "client state" (filter selections, open panels, pagination cursor).

**How to avoid:**
- Use React Query (TanStack Query) for all server state — transactions, balances, statement data. It handles caching, background refetching, loading/error states, and stale data automatically.
- Use Zustand or React Context only for client UI state — active filters, selected account, date range picker values, open/closed panels.
- Keep the global store small and serializable: `{ selectedAccountId, dateRange, activeFilters, sidebarOpen }`. Nothing else.
- Define a clear rule at project start: "If the data comes from an API, it lives in React Query. If the data is user interaction state, it lives in Zustand."

**Warning signs:**
- `useEffect` calls that dispatch to a Redux store after `await fetch(...)`.
- Manual loading state: `dispatch(setLoading(true)); await fetch(); dispatch(setData(result)); dispatch(setLoading(false))`.
- API response data stored in global Zustand store and manually refreshed on navigation.
- Selector logic for filtering/sorting applied over full normalized entity map in the store.

**Phase to address:** Phase 1 (architecture decision) — the server-state vs. client-state separation must be decided before any data fetching is implemented.

**Confidence:** HIGH — The server-state vs. client-state distinction is the core design principle behind TanStack Query, documented in its official documentation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode API base URL in fetch calls | Faster initial setup | Every component needs updating when URL changes; no easy environment switching | Never — use an env var + adapter constant from day one |
| Use `any` type for API response | Skip writing API types | Type errors only surface at runtime; refactoring is blind | Never — write types from API docs first |
| `new Date()` without timezone | Works in local dev | Wrong dates in UTC CI, wrong statement grouping for international users | Never for financial dates |
| Filter/sort in component with `.filter().sort()` | Simple to write | Re-computes on every render; slow for 500+ items | Acceptable with `useMemo`, never without |
| Fetch all data, show spinner until complete | No progressive loading complexity | 3–8 second blank screen on real data; unacceptable mobile UX | Never for production — skeleton loading is mandatory |
| Store API key in `VITE_` env var | Easy secret management in dev | Key is exposed in compiled JS bundle, visible in DevTools | Only acceptable for read-only public APIs with no user data |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Third-party banking API (e.g., Timo, VCB, MBBank APIs) | Call directly from browser with API key in headers | Route through a serverless proxy (Netlify/Vercel function) that injects the secret server-side |
| Vietnamese banking APIs | Assume amounts are float numbers | VND has no subunit — amounts are integers; some APIs return amounts as strings to preserve precision |
| Credit card statement API | Use `transactionDate` to determine cycle | Use `statementDate` or `billingCycleStart/End` fields — transaction post date and statement date differ by days |
| Any API with pagination | Call without `limit` param on first load | Always pass `limit=50` (or API max) and handle `hasMore` / `nextCursor` from response |
| API rate limits | Make one request per filter change | Debounce filter inputs (300ms), batch requests, use React Query's `staleTime` to avoid redundant calls |
| API returning ISO 8601 UTC timestamps | Parse with `new Date(str)` | Parse with explicit timezone using `date-fns-tz` `parseISO` + `toZonedTime('Asia/Ho_Chi_Minh')` |
| Mock API during dev | Build mock that returns camelCase; real API uses snake_case | Mirror real API schema exactly in mock; use an adapter/mapper in the data layer, not in components |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all transactions in DOM without virtualization | Scroll jank, 60+ ms frame times, mobile freeze | Use `@tanstack/virtual` for list rows; only render visible items + overscan buffer | ~200+ DOM rows on low-end mobile, ~1000+ on desktop |
| Re-filtering/sorting on every render | Filter feels sluggish with 200+ transactions | Wrap filter/sort in `useMemo`; memoize comparison functions | 100+ items without `useMemo` on mid-tier devices |
| Fetching from API on every navigation/tab switch | Slow tab switching, redundant network calls | Set React Query `staleTime: 5 * 60 * 1000` (5 min) — data stays fresh without refetch | Without `staleTime`, refetch happens on every component mount |
| Unthrottled search input triggering API calls | API rate-limit errors, input feels laggy | Debounce search input 300ms; search client-side over already-fetched data before hitting API | Any search input without debounce |
| Large state object causing full tree re-render | Unrelated components re-render on transaction load | Split Zustand store into small atoms or use selectors with `shallow` equality; keep server state in React Query | As soon as global store mixes server data + UI state |
| Chart libraries rendering on every transaction update | Charts re-animate on every filter change | Memoize chart data derivation; use `React.memo` on chart component with stable data prop | Charts without memoization on filtered dataset |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API secret key in `VITE_*` env variable | Key visible in compiled JS bundle, browser DevTools, and source maps — anyone can steal it and call the API | Route authenticated calls through a serverless proxy; never expose secrets to the browser |
| No Content Security Policy (CSP) header | XSS attack can read DOM financial data and exfiltrate to attacker's server | Set CSP meta tag or server header: restrict `script-src`, `connect-src` to known origins only |
| Loading transaction data into `localStorage` as a cache | Financial data persists on device, accessible to other browser tabs/scripts on same origin | Never cache sensitive financial data client-side; rely on React Query's in-memory cache (clears on page close) |
| Displaying full account numbers from API | IBAN/account number exposure in DOM — readable by browser extensions | Mask account numbers: show only last 4 digits (`****1234`) in the UI; never log full numbers to console |
| No error boundary around API data | Unhandled promise rejection leaks API error details (including URLs and tokens) to console | Wrap data-fetching components in React error boundaries; sanitize error messages shown to user |
| CORS proxy that forwards all origins | A proxy with `Access-Control-Allow-Origin: *` allows any site to use your API key via your proxy | Restrict proxy to your specific domain origin; validate `Origin` header in the serverless function |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Full-page spinner until all transactions loaded | User sees blank screen for 3–8 seconds; abandons page | Show skeleton cards immediately; load critical data (balance summary) first, transactions progressively |
| Displaying amounts in raw API format (e.g., `1500000` without formatting) | Users must mentally parse large numbers; unreadable for VND amounts | Format with `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` at render layer |
| No empty state for filtered results | Filter returns 0 results — user thinks app is broken or still loading | Implement explicit empty state: "No transactions found for this period" with clear action to reset filters |
| Using browser default date format for statement dates | Dates display differently per OS locale (MM/DD vs DD/MM) — confusing for Vietnamese users | Always format dates explicitly: `dd/MM/yyyy` using `date-fns` format, not `toLocaleDateString()` |
| Credit card statement cycle UI not clearly explaining the cycle | Users confuse "transaction date" with "statement date" — think charges are missing | Label clearly: "Statement Period: 15 Jan – 14 Feb" with tooltip explaining what charges are included |
| No visual distinction between debit (bank) and credit card transactions | Users scroll through mixed list unable to categorize mentally | Color-code or icon-tag by account type; group by account in default view |
| Pagination without maintaining scroll position | After loading more, user is scrolled to top | Maintain scroll position with `useRef` or implement infinite scroll that appends without scroll reset |

---

## "Looks Done But Isn't" Checklist

- [ ] **Currency display:** Verify `Intl.NumberFormat` output for VND — confirm no decimal places, correct thousands separator (`1.500.000` not `1,500,000` for vi-VN locale), currency symbol placement.
- [ ] **Statement cycle grouping:** Verify transactions at boundary dates (day of cutoff) fall into correct cycle — test with a transaction timestamped at 23:59 on cutoff day Vietnam time.
- [ ] **Error states:** Every API call has a visible error state — not just console.log. Test by blocking the API URL in DevTools Network tab.
- [ ] **Loading states:** Every data section shows skeleton/spinner while loading — verify by throttling network to "Slow 3G" in DevTools.
- [ ] **Empty states:** Filter to a date range with no transactions — verify user sees "no results" message, not a blank section.
- [ ] **CORS in production:** Deploy to actual production URL (not localhost) and verify API calls succeed — CORS errors only appear in real cross-origin context.
- [ ] **Mobile scroll performance:** Open transaction list on a real low-end Android device (or Chrome DevTools CPU 6x slowdown) with 500+ rows — verify 60fps scroll.
- [ ] **API key not in bundle:** Open production build DevTools → Sources → search for the API key string — it must not appear.
- [ ] **Timezone edge cases:** Set system clock to UTC and verify statement grouping still produces Vietnam-local dates.
- [ ] **Large amount arithmetic:** Sum 100 VND amounts from the API — verify result is exactly correct integer with no floating point drift.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API key exposed in bundle | HIGH | Rotate key immediately with provider; add serverless proxy; redeploy; audit access logs for unauthorized usage |
| Mock-to-real API mismatch discovered late | HIGH | Write API response adapter (mapper function) to convert real schema to UI schema; update TypeScript types; regression-test all components |
| Float arithmetic errors in totals | MEDIUM | Audit all arithmetic — replace with integer math for VND; add `dinero.js` for multi-currency; add snapshot tests for known sums |
| Timezone-wrong statement grouping | MEDIUM | Add `date-fns-tz` dependency; audit all `new Date()` usage; fix grouping logic; add timezone-explicit tests |
| Performance: all transactions in DOM | MEDIUM | Add `@tanstack/virtual` to list component; this is an isolated change that doesn't require data layer rework |
| Redux/manual state overengineering | HIGH | Migrate server data to React Query (one feature at a time); this is a significant refactor touching every data-fetching component |
| CORS blocked in production | HIGH | Add serverless proxy (Netlify/Vercel function) — requires architecture change; can be mitigated short-term with a CORS proxy service (security tradeoff) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| API called directly from browser / secret exposed | Phase 1: API adapter + proxy setup | Deploy to non-localhost URL, open DevTools, verify no API key in Network headers and no CORS errors |
| Mock-to-real API schema mismatch | Phase 1: Define TypeScript API types from real docs before mocking | Integration test with real API returns no TypeScript errors in adapter layer |
| Float arithmetic on currency | Phase 1: Data layer / TypeScript contracts | Unit test: sum 10 known VND amounts, verify integer result with no decimal drift |
| Timezone confusion on dates | Phase 1 (model) + Phase 2 (statement display) | Set test runner timezone to UTC; verify statement grouping tests still pass |
| Fetching all transactions on mount | Phase 1 (API interface design) + Phase 2 (transaction list component) | Load page with network throttled; verify initial render under 2 seconds with paginated fetch |
| Overengineered global state | Phase 1: Architecture decision | Code review: zero `useEffect` + `setState` patterns for server data; all API data in React Query |
| No virtualization on transaction list | Phase 2: Transaction list component | Chrome DevTools Performance tab: scroll 500 rows at 60fps on 6x CPU slowdown |
| Financial data in localStorage | Phase 1 or Phase 2 | Open Application tab in DevTools after loading transactions; localStorage and sessionStorage must be empty of transaction data |
| Non-explicit date formatting | Phase 2: All date display components | Test on machine with en-US locale; verify dates display in dd/MM/yyyy format regardless of system locale |
| No error/empty states | Phase 2: Each feature component | Block API in DevTools Network; verify error UI appears. Apply impossible filter; verify empty state appears. |

---

## Sources

- MDN Web Docs — Fetch Living Standard / CORS specification (CORS behavior is browser-specification-level fact): https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- ECMAScript specification — IEEE 754 float behavior in JavaScript `number` type (float arithmetic is spec-level fact)
- ECMAScript Internationalization API (`Intl.NumberFormat`) — documented behavior for currency formatting including `vi-VN` locale
- TanStack Query documentation — server state vs. client state architecture pattern (core library design principle)
- date-fns-tz documentation — timezone-aware date parsing pattern for `Asia/Ho_Chi_Minh`
- MEDIUM confidence: Frontend financial app integration patterns (CORS proxy requirement, mock-to-real schema mismatch, float precision) — established community patterns, not single-source-verified during this session
- LOW confidence: Specific Vietnamese banking API response formats (VND as integer string) — based on known VND monetary convention (0 decimal places, ISO 4217) and common API design patterns; actual format varies by provider and must be verified against real API docs

---

*Pitfalls research for: Frontend-only personal finance dashboard (FinanceManager)*
*Researched: 2026-03-02*
