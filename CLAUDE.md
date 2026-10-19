# CLAUDE.md — FinanceManager Project Reference

## Overview

Personal finance dashboard (React + TypeScript + Vite) for managing bank accounts and credit card transactions, kèm quản lý thẻ (thêm/sửa/xoá), gán MCC cho giao dịch thẻ và hoàn tiền ước tính theo rule của từng thẻ (`docs/credit-card-cashback.md`). Backed by **Supabase** (Postgres + Auth + RLS + Edge Functions). Giao dịch được nạp tự động từ thông báo SMS/push của ngân hàng qua iOS Shortcut → Edge Function `parse-transaction`.

---

## Quick Start

```bash
npm install
supabase start               # Postgres + Auth local (cần Docker)
cp .env.example .env.local   # điền VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```
Đăng nhập local bằng test user trong `supabase/seeds/seed.sql`: `test@local.dev` / `testpassword123`

⚠️ `supabase/seeds/*` bị **`.gitignore`** (chứa dữ liệu thẻ thật) nên **máy sạch / clone mới không có seed**. Thêm nữa
`supabase/config.toml` không khai báo `[db.seed]` (CLI mặc định tìm `supabase/seed.sql`, không phải `seeds/seed.sql`), nên nhiều
khả năng `supabase db reset` cũng không nạp nó (chưa chạy thử vì reset xoá dữ liệu local) — khi đó test integration không đăng nhập được.
Muốn áp migration mới lên DB local mà **giữ dữ liệu**: `supabase migration up --local` (không phải `db reset`).
Nếu `supabase` không có trong PATH (cài qua nvm): `~/.nvm/versions/node/<ver>/bin/supabase`.

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
│   ├── creditCards/     # CreditCardSelector, CardFormDialog, DeleteCardDialog, BillingCycleGroup, BillingCycleInfoCard,
│   │                    #   CreditCardTransactionRow (chọn MCC), CashbackSummary / CashbackRulesEditor / CashbackRuleForm, BankLogo
│   ├── dashboard/       # StatCard, CategoryChart, DashboardDatePicker, BudgetProgressSection
│   ├── chatbot/         # ChatPanel, ChatMessage, ChatInput, ChatSettings, ChatButton
│   └── auth/            # AuthProvider, LoginPage, ProtectedRoute
├── components/
│   ├── layout/          # AppShell, AppHeader
│   ├── filters/         # FilterBar, SearchInput, DateRangePicker, CategoryFilter, ExportButton
│   ├── budget/          # BudgetProgressBar, BudgetSettings
│   ├── form/            # FormField (nhãn+gợi ý+lỗi), form-aria (describedBy)
│   └── ui/              # shadcn components
├── hooks/               # useAccounts, useTransactions, useCreditCards, useCreditCardTransactions, useCreditCardMutations,
│                        #   useUpdateTransactionMcc, useCashbackRules, useCycleCashback, useNow,
│                        #   useDashboardStats, useBudgetAlerts, useDebounced, useAuth
├── lib/supabase.ts      # Supabase client singleton
├── services/            # supabase-js: accounts, creditCards, credit-card-mutations, cashbackRules, dashboard, exports
│                        #   mappers (snake_case→camelCase + Zod), transactionQuery (filter/keyset)
├── stores/              # filterStore, dashboardStore, budgetStore, categoryOverrideStore, chatStore, themeStore
├── types/               # api.ts, account.ts, creditCard.ts, credit-card-form.ts, cashback.ts, cashback-form.ts,
│                        #   form-fields.ts (moneyAmountField), budget.ts, categories.ts
├── utils/               # dates, currency, categories, csv, billingCycle, mcc, cashback
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
credit_cards   id, user_id (default auth.uid()), bank_name, card_name, card_number, card_type, currency,
               credit_limit, current_balance, statement_date (1..31), payment_due_date, last_updated
               unique (user_id, bank_name, card_number)
card_cashback_rules  id, user_id, card_id → credit_cards (cascade), mcc text|NULL (NULL = rule mặc định),
               rate_percent numeric(5,2) 0..100, min_cycle_spend bigint, cap_per_cycle bigint|NULL (>0)
               unique nulls not distinct (card_id, mcc)
unparsed_messages  tin không ghi được (source, reason) — chỉ service_role đọc được

transactions.mcc  text|NULL, 4 chữ số — USER gán tay (SMS ngân hàng VN không có MCC)
```

**RPC:** `get_dashboard_stats(p_date_from, p_date_to)` → JSON khớp `DashboardStatsSchema`.
`delete_credit_card(p_card_id)` → số giao dịch đã xoá: xoá thẻ **kèm toàn bộ giao dịch** nguyên tử (khoá dòng
thẻ trước), lỗi `P0002` nếu thẻ không tồn tại / của người khác. **Xoá thẻ luôn qua RPC này**, không `delete`
trần: FK `transactions.card_id` là `on delete set null` nên giao dịch thành mồ côi (xem cảnh báo bên dưới).
Cả hai RPC dùng `security invoker` để tôn trọng RLS — **không được đổi sang `security definer`**.

**RLS:** mọi bảng bật RLS, policy `auth.uid() = user_id`. `anon` bị `revoke all`.
`transactions` insert/update kiểm thêm `card_id`/`account_id` **thuộc chính user**; `card_cashback_rules`
insert/update kiểm thẻ thuộc user. Chỉ kiểm `user_id` là chưa đủ: FK vẫn chấp nhận trỏ sang thẻ của
người khác, và khi họ xoá thẻ thì giao dịch bị `set null` thành mồ côi.
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

Form thẻ (`credit-card-form.ts`) vì thế **ép `card_number` dạng `****xxxx`** (unique ở DB chỉ chặn trùng chính xác, còn
`5678` và `****5678` cùng khớp một `LIKE`) và **chuẩn hoá hoa/thường `bank_name`** theo `KNOWN_BANK_NAMES`
(`bank-branding.ts`): edge function so khớp `bank_name` bằng `.eq()` chính xác, phân biệt hoa thường.

## Edge Function (`supabase/functions/parse-transaction/`)

iOS Shortcut POST `{ "text": "<nội dung notification>", "source": "<bank_name>" }` + header
`x-shortcut-secret`. Setup Shortcut (trigger Notification iOS 27 / Message / Email): `docs/ios-shortcut-setup.md`.
Luồng: OTP → chống trùng (cùng `raw_text` trong 10 phút) → 11 regex parser → `unparsed_messages`
(kèm `source`, `reason`). Bank chưa có parser: lấy mẫu thật từ `unparsed_messages` rồi viết regex.
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
| `useCreateCreditCard()` / `useUpdateCreditCard(card)` / `useDeleteCreditCard()` | Mutations; invalidate thẻ, giao dịch thẻ, dashboard, rule, chi tiêu chu kỳ |
| `useCardTransactionCount(cardId)` | Đếm giao dịch của thẻ (luôn lấy mới) cho dialog xoá |
| `useUpdateTransactionMcc()` | Gán/bỏ MCC, optimistic ở mọi trang cache, hoàn tác đúng giao dịch khi lỗi |
| `useCashbackRules(cardId)` / `useSaveCashbackRule` / `useDeleteCashbackRule` | Rule hoàn tiền của thẻ |
| `useCycleCashback(cardId, cycle)` | `{ result, rules, isLoading, isError, refetch }` — rule + chi tiêu chu kỳ → `computeCashback` |
| `useNow(intervalMs = 60000)` | Thời điểm hiện tại (ISO) tự cập nhật — để chu kỳ sao kê sang kỳ mới khi tab mở qua mốc cắt |
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
CreditCardTransaction { id, cardId, amount, description, merchantName, category?, mcc?, type, status, transactionDate, billingCycleStart?, billingCycleEnd? }

// cashback.ts
CashbackRule { id, cardId, mcc: string | null, ratePercent, minCycleSpend, capPerCycle: number | null }
CashbackResult { total, byRule: RuleCashback[], unmatchedSpend }

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
computeCurrentCycle(statementDay, nowISO)         → BillingCycle   // ngày sao kê 29-31 được KẸP vào độ dài tháng
groupTransactionsByCycle(txs, currentCycle)       → BillingCycleGroupData[]
formatCycleDateRange(startISO, endISO)            → { startDisplay, endDisplay }
```
Chu kỳ là khoảng **nửa mở `[startISO, endISO)`**; truy vấn dùng `dateFrom` + `dateBefore` (cận trên loại trừ).

### MCC (`mcc.ts`)
```typescript
MCC_OPTIONS                       // 16 mã {code, label, keywords} — user chọn tay
suggestMcc(merchantName)          → mã | null   // chỉ GỢI Ý, không bao giờ tự lưu; khớp theo ranh giới từ, từ khoá dài nhất thắng
getMccLabel(code) / formatMcc(code)   // "5411 · Siêu thị"
```

### Cashback (`cashback.ts`)
```typescript
computeCashback(rules, txs)       → { total, byRule, unmatchedSpend }
```
Chỉ tính giao dịch chi; mỗi giao dịch vào 1 rule (MCC trùng → rule mặc định → unmatched); ngưỡng và trần áp **riêng từng rule**;
làm tròn xuống trên tổng rule bằng **điểm cơ bản nguyên** (số thực sai 1đ: 0,57% × 1.000.000 → 5.699). Luôn hiển thị là "ước tính".

---

## Testing

| Loại | File | Cần Docker |
|---|---|---|
| Unit | `src/**/*.test.{ts,tsx}` | Không |
| Integration | `src/**/*.integration.test.ts` | Có (`supabase start`) |
| Parser (Deno) | `supabase/functions/parse-transaction/parsers.test.ts` | Có |

Component test mock ở tầng service (`vi.mock('@/services/...')`), không chạm DB.
Integration test chạy trên Supabase local với `supabase/seeds/seed.sql` — số liệu cố định,
kỳ vọng ghi ở cuối file seed. `src/test/integration-setup.ts` chặn không cho trỏ vào
production (bảo vệ khỏi `db reset` xoá data thật).

**Chạy integration:** `.env`/`.env.local` trỏ remote nên guard sẽ chặn. Tạo `.env.test.local` (gitignored, ưu tiên cao
nhất) trỏ về local: `VITE_SUPABASE_URL=http://127.0.0.1:54321` + `VITE_SUPABASE_ANON_KEY` lấy từ `supabase status -o env`.
Cổng 54321/54322 phải trống (các stack Supabase của dự án khác dùng cùng cổng).

**Quy ước test:**
- Các file integration **dùng chung 1 DB** với `services.integration.test.ts` (assert tổng cố định theo seed) → mọi dữ liệu
  tạo ra phải dọn sạch, kể cả khi test fail (`afterAll` + dọn dữ liệu sót ở `beforeAll`; xoá thẻ bằng RPC `delete_credit_card`).
- Form dài: điền bằng `fireEvent.change`, **không** `userEvent.type` từng phím — chậm gấp chục lần khi cả bộ chạy song
  song và vượt timeout 5s.
- Component dùng hook thật cần 1 test **mount thật** (render loop từng lọt qua hàng trăm test xanh vì không test nào mount nó).
- Sau khi thêm test, **phá code có chủ đích** (mutation thủ công) để chắc test thật sự bắt được lỗi; khôi phục bằng đúng đường dẫn
  (một lần khôi phục nhầm đường dẫn đã để sót một file thừa).

**RLS chéo 2 user** (integration chỉ có 1 test user): `supabase/tests/card-crud-rls.sql` chạy trên Postgres 17 tạm
(`docker run postgres:17-alpine` + `scratch-stub.sql` giả `auth.uid()`), hướng dẫn ở đầu file. Không chạy trên stack Supabase đang dùng.

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
9. **Cashback tính khi đọc, không lưu:** `computeCashback` chạy ở client từ rule + giao dịch của chu kỳ; đổi rule/MCC
   thì cập nhật cho cả giao dịch cũ. MCC **độc lập** với `Category` (Category cho thống kê, MCC cho hoàn tiền).
10. **Số tiền nhập tay** dùng `moneyAmountField` (`form-fields.ts`): chỉ số thuần hoặc nhóm nghìn **cùng một dấu tách**;
    không đoán `1.5` / `1,000.000` (từng bị đọc thành 15đ / 1.000.000đ).
11. **Không cắt cụt im lặng:** `exportTransactions` báo lỗi khi vượt 100 trang (50.000 dòng) thay vì trả mảng thiếu —
    dữ liệu thiếu làm CSV và hoàn tiền ước tính sai mà không ai biết.

---

## Deployment (Vercel)

- Install: `npm ci`
- Build: `npm run build` → `dist/`
- Env: set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` trong Vercel dashboard
- Region: `sfo1`
