# CLAUDE.md — FinanceManager Project Reference

## Overview

Personal finance dashboard (React + TypeScript + Vite) for managing bank accounts and credit card transactions. Backed by **Supabase** (Postgres + Auth + RLS + Edge Functions). Giao dịch được nạp tự động từ thông báo SMS/push của ngân hàng qua iOS Shortcut → Edge Function `parse-transaction`.

---

## Quick Start

```bash
npm install
supabase start               # Postgres + Auth local (cần Docker)
cp .env.example .env.local   # điền VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```
Đăng nhập local bằng test user trong `supabase/seed.sql`: `test@local.dev` / `testpassword123`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (HMR) |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (không cần Docker) |
| `npm run test:integration` | Integration tests (cần `supabase start`) |
| `npm run test:all` | Cả hai |
| `npm run test:coverage` | Coverage (unit) |

---

## Environment Variables

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321      # `supabase status` cho local
VITE_SUPABASE_ANON_KEY=<anon-key>
```
Anon key nằm trong bundle JS của browser — **RLS ở DB là lớp bảo vệ duy nhất**.
Production: set 2 biến này trong Vercel dashboard (không hardcode vào `vercel.json`).

Edge function secrets (`supabase secrets set`): `SHORTCUT_SECRET`, `DEFAULT_USER_ID`.

---

## Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **TanStack React Query 5** — data fetching & caching
- **Zustand 5** — state management
- **Zod 4** — schema validation at service boundary
- **React Router DOM 7** — routing
- **Tailwind CSS 4** + **shadcn/radix-ui** — styling & UI
- **Recharts** — charts (lazy-loaded, ~372KB chunk)
- **Supabase** — Postgres, Auth, RLS, Edge Functions (`@supabase/supabase-js`)
- **Sonner** — toast notifications
- **@anthropic-ai/sdk** — chatbot feature
- **@date-fns/tz** — Vietnam timezone (UTC+7)
- **papaparse** — CSV export

---

## Routing (`src/App.tsx`)

```
/              → redirect to /accounts
/dashboard     → DashboardPage
/accounts      → BankAccountsPage
/credit-cards  → CreditCardsPage
```

All routes wrapped in `<AppShell>` (header + layout + chat button/panel).

---

## Project Structure

```
src/
├── pages/               # DashboardPage, BankAccountsPage, CreditCardsPage
├── features/
│   ├── accounts/        # AccountTabs
│   ├── transactions/    # TransactionList, TransactionRow, Skeleton, EmptyState
│   ├── creditCards/     # CreditCardTabs, BillingCycleGroup, BillingCycleInfoCard
│   ├── dashboard/       # StatCard, CategoryChart, DashboardDatePicker, BudgetProgressSection
│   ├── chatbot/         # ChatPanel, ChatMessage, ChatInput, ChatSettings, ChatButton
│   └── auth/            # AuthProvider, LoginPage, ProtectedRoute
├── components/
│   ├── layout/          # AppShell, AppHeader
│   ├── filters/         # FilterBar, SearchInput, DateRangePicker, CategoryFilter, ExportButton
│   ├── budget/          # BudgetProgressBar, BudgetSettings
│   └── ui/              # shadcn components
├── hooks/               # useAccounts, useTransactions, useCreditCards, useCreditCardTransactions, useDashboardStats, useBudgetAlerts, useDebounced, useAuth
├── lib/supabase.ts      # Supabase client singleton
├── services/            # supabase-js: accounts, creditCards, dashboard, exports
│                        #   mappers (snake_case→camelCase + Zod), transactionQuery (filter/keyset)
├── stores/              # filterStore, dashboardStore, budgetStore, categoryOverrideStore, chatStore, themeStore
├── types/               # api.ts, account.ts, creditCard.ts, budget.ts, categories.ts
├── utils/               # dates, currency, categories, csv, billingCycle
├── test/                # fixtures/, integration-setup.ts
└── lib/utils.ts         # cn() = clsx + twMerge
```

---

## Database Schema (Supabase)

```
transactions
  id uuid PK | user_id → auth.users NOT NULL | bank_name text | amount bigint (VND, dương=thu, âm=chi)
  currency text | transaction_date timestamptz | description text | raw_text text
  source_type 'bank'|'credit_card' | account_ref text (4 ký tự cuối, resolve FK)
  account_id → accounts | card_id → credit_cards   (nullable — xem cảnh báo bên dưới)
  merchant_name text | category text | status 'pending'|'posted' | created_at timestamptz

accounts       id, user_id, bank_name, account_name, account_number, account_type,
               currency, balance bigint, last_updated
credit_cards   id, user_id, bank_name, card_name, card_number, card_type, currency,
               credit_limit, current_balance, statement_date, payment_due_date, last_updated
unparsed_messages  SMS không khớp parser nào (chỉ service_role đọc được)
```

**RPC:** `get_dashboard_stats(p_date_from, p_date_to)` → JSON khớp `DashboardStatsSchema`.
Dùng `security invoker` để tôn trọng RLS — **không được đổi sang `security definer`**.

**RLS:** mọi bảng bật RLS, policy `auth.uid() = user_id`. `anon` bị `revoke all`.
`transactions.user_id` là **NOT NULL** — row user_id null sẽ vô hình với mọi policy
(`auth.uid() = null` → NULL) và không cách nào xoá từ client.

**Truy vấn giao dịch:** dùng `TX_COLUMNS` (`src/services/transactionQuery.ts`), **không dùng
`select('*')`** — `*` kéo cả `raw_text` (nguyên văn SMS: số dư, tên người chuyển) về browser
dù không mapper nào đọc. `countOption(cursor)` chỉ đếm ở trang đầu, vì `totalForPage()`
vứt bỏ count từ trang 2 trở đi.

⚠️ **`account_number`/`card_number` phải kết thúc bằng đúng `account_ref` mà parser bắt được**
(vd LPBank → `****x265`). Sai format thì edge function không resolve được FK, và hậu quả
KHÔNG hiển nhiên: giao dịch đó **không hiện trong danh sách** (mọi query lọc theo
`account_id`/`card_id`) nhưng **vẫn được dashboard đếm** → tổng thu/chi lệch với danh sách.
Dùng `getUnlinkedCount()` (`src/services/accounts.ts`) để phát hiện.

## Edge Function (`supabase/functions/parse-transaction/`)

iOS Shortcut POST `{ "text": "<nội dung notification>" }` + header `x-shortcut-secret`.
11 parser: LPBank (app + SMS), SHB, HDBank, MSB, VPBank, WOORIVN, UOB, Sacombank, MoMo, BIDV.

**Giới hạn `text` 2000 ký tự (`MAX_TEXT_LENGTH`) — không được bỏ.** Regex parser chạy đồng bộ
và có độ phức tạp phi tuyến với input dài (đo thật: 203KB = 8.665ms trước khi neo regex SHB).
Thông báo ngân hàng thật < 500 ký tự. Khi viết parser mới: **không dùng `.*?` / `.+?` không neo**,
dùng `[^\n]{0,N}?` để chặn backtracking.

Secret so sánh bằng hash SHA-256 + XOR toàn bộ (constant-time), không dùng `!==`.
Response **không** trả `raw_text` về client.
Test: `docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app denoland/deno:2.1.4 test --allow-all parsers.test.ts`

## State Management (`src/stores/`)

| Store | Persisted | Description |
|---|---|---|
| `filterStore` | No | accountId, cardId, dateFrom, dateTo, searchQuery, txType, category |
| `dashboardStore` | No | Independent date range for dashboard page |
| `budgetStore` | localStorage | Budget amounts per Category |
| `categoryOverrideStore` | localStorage | User overrides for transaction categories |
| `chatStore` | localStorage | Chat messages, isOpen, apiConfig |
| `themeStore` | localStorage | 'light' \| 'dark' |

**Important:** Multi-field selectors must use `useShallow` to prevent infinite re-renders (Zustand v5).

---

## Custom Hooks (`src/hooks/`)

| Hook | Returns |
|---|---|
| `useAccounts()` | `{ data: BankAccount[], ... }` |
| `useTransactions()` | Infinite query, reads from filterStore |
| `useCreditCards()` | `{ data: CreditCard[], ... }` |
| `useCreditCardTransactions()` | Infinite query, reads from filterStore |
| `useDashboardStats()` | Current + previous month stats (month-over-month delta) |
| `useBudgetAlerts(breakdown, budgets)` | `{ alerts, warningCount, overbudgetCount }` — fires Sonner toasts |
| `useDebounced(value, delayMs)` | Debounced value |

---

## Types (`src/types/`)

```typescript
// account.ts
BankAccount { id, bankName, accountName, accountNumber, accountType, currency, balance, lastUpdated }
Transaction { id, accountId, amount, description, merchantName?, category?, type, status, transactionDate, postedDate? }
// amount: positive = income, negative = expense

// creditCard.ts
CreditCard { id, bankName, cardName, cardNumber, cardType, currency, creditLimit, currentBalance, statementDate, paymentDueDate, lastUpdated }
CreditCardTransaction { id, cardId, amount, description, merchantName, category?, type, status, transactionDate, billingCycleStart?, billingCycleEnd? }

// categories.ts
type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'

// api.ts
PaginatedResponse<T> { data: T[], nextCursor: string | null, total: number }
ApiError { code: string, message: string, details?: unknown }
```

---

## Utility Functions (`src/utils/`)

### Currency (`currency.ts`)
```typescript
formatVND(amount)         → "đ 1.500.000"
formatVNDSigned(amount)   → "- đ 500.000"
parseVND(str)             → number
```

### Dates (`dates.ts`)
```typescript
toVietnamDate(isoUtcString)             → TZDate (UTC+7)
formatDisplayDate(isoString)            → "15/01/2026"
formatDisplayDateTime(isoString)        → "15/01/2026 14:30"
calculateMonthDelta(current, previous)  → number | null (% change)
getPreviousMonthDateRange(from, to)     → { prevFrom, prevTo }
```

### Categories (`categories.ts`)
```typescript
classifyTransaction(merchantName?)  → Category   // Auto-classify by merchant keywords
getCategoryLabel(category)          → string
CATEGORY_TAXONOMY                   // Record<Category, string[]> keyword map
```

### CSV (`csv.ts`)
```typescript
formatTransactionForCSV(tx, accountOrCard?, overrides?)  → CSVTransactionRow
downloadCSV(csvString, filename)                         // UTF-8 BOM download
```

### Billing Cycle (`billingCycle.ts`)
```typescript
computeCurrentCycle(statementDay, nowISO)         → BillingCycle
groupTransactionsByCycle(txs, currentCycle)       → BillingCycleGroupData[]
formatCycleDateRange(startISO, endISO)            → { startDisplay, endDisplay }
```

---

## Testing

| Loại | File | Cần Docker |
|---|---|---|
| Unit | `src/**/*.test.{ts,tsx}` | Không |
| Integration | `src/**/*.integration.test.ts` | Có (`supabase start`) |
| Parser (Deno) | `supabase/functions/parse-transaction/parsers.test.ts` | Có |

Component test mock ở tầng service (`vi.mock('@/services/...')`), không chạm DB.
Integration test chạy trên Supabase local với `supabase/seed.sql` — số liệu cố định,
kỳ vọng ghi ở cuối file seed. `src/test/integration-setup.ts` chặn không cho trỏ vào
production (bảo vệ khỏi `db reset` xoá data thật).

---

## Key Architecture Decisions

1. **Supabase trực tiếp từ client:** không có backend riêng; `src/services/*` gọi supabase-js.
   **Mọi truy cập DATA phải qua service layer** — component không được `.from()` trực tiếp.
   Ngoại lệ duy nhất: `supabase.auth.*` (login/logout/session) dùng thẳng trong
   `features/auth/` và `AppHeader` (nút đăng xuất) — auth không phải data.
2. **Keyset Pagination:** cursor = base64 của `(transaction_date, id)` — ổn định hơn offset
   khi có row mới chèn vào giữa lúc scroll. Xem `src/services/transactionQuery.ts`.
3. **Filter Params in QueryKey:** TanStack Query auto-refetches when any filter changes — all filter values are part of queryKey.
4. **Zod at Service Boundary:** mọi response validate bằng Zod trong service layer.
   `mappers.ts` đổi snake_case→camelCase và chuẩn hoá timestamptz về ISO `Z`
   (PostgREST trả `+00:00`, Zod `.datetime()` chỉ nhận `Z`).
5. **Dashboard Store Separate:** `dashboardStore` is independent from `filterStore` — allows different date ranges simultaneously.
6. **Recharts Lazy-Loaded:** CategoryChart uses `React.lazy()` to split the 372KB recharts chunk.
7. **Vietnam Timezone:** All date display via `@date-fns/tz` (UTC+7) to avoid midnight UTC edge cases.
8. **Path Alias:** `@` → `src/` (configured in `vite.config.ts`).

---

## Deployment (Vercel)

- Install: `npm ci`
- Build: `npm run build` → `dist/`
- Env: set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` trong Vercel dashboard
- Region: `sfo1`
