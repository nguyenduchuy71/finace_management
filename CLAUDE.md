# CLAUDE.md — FinanceManager Project Reference

## Overview

Personal finance dashboard (React + TypeScript + Vite) for managing bank accounts and credit card transactions, kèm quản lý thẻ (thêm/sửa/xoá), gán MCC cho giao dịch thẻ và hoàn tiền ước tính theo rule của từng thẻ (`docs/credit-card-cashback.md`). Backed by **Supabase** (Postgres + Auth + RLS + Edge Functions). Giao dịch được nạp tự động từ thông báo SMS/push của ngân hàng qua iOS Shortcut → Edge Function `parse-transaction`. Giao diện thương hiệu **"Ví Jade"** (sáng/tối, xem [Styling](#styling--ví-jade)).

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
| `npm run lint` | ESLint — **phải sạch (0 lỗi/cảnh báo)**. `src/components/ui/**` tắt `react-refresh/only-export-components` (file shadcn export kèm `*Variants` theo cấu trúc chuẩn upstream) |
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
- **Tailwind CSS 4** + **shadcn/radix-ui** — styling & UI; font **Be Vietnam Pro** tự host (`@fontsource`)
- **Recharts** — charts (lazy-loaded, ~372KB chunk)
- **Supabase** — Postgres, Auth, RLS, Edge Functions (`@supabase/supabase-js`)
- **Sonner** — toast notifications
- **@anthropic-ai/sdk** — chatbot feature
- **@date-fns/tz** — Vietnam timezone (UTC+7)
- **papaparse** — CSV export

### Styling — Ví Jade

- Token màu ở `src/index.css` (`:root` sáng, `.dark` tối). Dùng utility ngữ nghĩa, **không** hardcode màu:
  `text-income` / `bg-income-soft`, `text-expense` / `bg-expense-soft`, `text-cashback` / `bg-cashback-soft` / `text-cashback-strong`,
  `text-internal` / `bg-internal-soft` (chuyển nội bộ), `bg-warning`.
- **KHÔNG** dùng green/red/emerald/rose cho thu/chi trong component (hiện 0 chỗ trong `src/` ngoài test).
- Biểu đồ: `--chart-1..6` ứng với 6 Category, map qua `src/utils/category-colors.ts` (`getCategoryChartColor`). Khoá là tên tiếng Việt của Category, không phải tiếng Anh.
- Utility: `.money` (số tabular, căn cột), `.heading-display` (tiêu đề số lớn).
- Font: `@fontsource/be-vietnam-pro` import trong `src/main.tsx`. CSP `font-src 'self' data:` chặn Google Fonts → không thêm link Google Fonts.
- Mọi cặp chữ/nền đo **WCAG AA (≥ 4.5:1)** ở cả hai theme. Đổi giá trị `oklch` thì đo lại.
- Chuyển động tôn trọng `prefers-reduced-motion` (xem `useCountUp`).

---

## Routing (`src/App.tsx`)

```
/              → redirect to /accounts
/dashboard     → DashboardPage
/accounts      → BankAccountsPage ("Giao dịch ngân hàng": ?view=inbox|recorded — hộp tin chưa phân loại / giao dịch theo TK)
/credit-cards  → CreditCardsPage (?view=all = "Nhiều thẻ"; mặc định "Từng thẻ")
```

Điều hướng: `src/components/layout/nav-items.ts` là **nguồn duy nhất** cho header (≥ `sm`) và thanh tab dưới `MobileTabBar` (< `sm`).

All routes wrapped in `<AppShell>` (header + layout + chat button/panel).

---

## Project Structure

```
src/
├── pages/               # DashboardPage, BankAccountsPage, CreditCardsPage
├── features/
│   ├── accounts/        # AccountTabs, RecordedTransactionsView, AccountFormDialog, DeleteAccountDialog
│   ├── unparsed/        # UnparsedInbox, UnparsedMessageItem, ResolveUnparsedDialog, UnparsedCountBadge
│   ├── transactions/    # TransactionList (nhóm theo ngày), TransactionRow, TransactionListSkeleton, TransactionEmptyState,
│   │                    #   DayGroupHeader, LoadMoreFooter
│   ├── creditCards/     # CreditCardSelector + MultiCardPicker (cùng dùng CardSearchListbox), CardVisual (thẻ vật lý),
│   │                    #   CycleProgress, MultiCardTransactionList (?view=all), CardFormDialog, DeleteCardDialog,
│   │                    #   BillingCycleGroup, BillingCycleInfoCard, CreditCardTransactionRow (chọn MCC, nút Sửa),
│   │                    #   MccPicker (chọn MCC có tìm kiếm), EditCardTransactionDialog,
│   │                    #   CashbackSummary / CashbackRulesEditor / CashbackRuleForm, BankLogo
│   ├── dashboard/       # StatCard, NetCashFlowCard, CategoryChart, DashboardDatePicker, BudgetProgressSection (bố cục bento)
│   ├── chatbot/         # ChatPanel, ChatMessage, ChatInput, ChatSettings, ChatButton
│   └── auth/            # AuthProvider, LoginPage, ProtectedRoute
├── components/
│   ├── layout/          # AppShell, AppHeader, MobileTabBar (< sm), PageHeader, nav-items.ts
│   ├── empty-state/     # EmptyState (icon + tiêu đề + mô tả + hành động)
│   ├── filters/         # FilterBar, SearchInput, DateRangePicker, CategoryFilter, ExportButton
│   ├── budget/          # BudgetProgressBar, BudgetSettings
│   ├── form/            # FormField (nhãn+gợi ý+lỗi), form-aria (describedBy)
│   └── ui/              # shadcn components + CategoryBadge, TransactionKindBadge, MeterBar (thanh tiến độ)
├── hooks/               # useAccounts, useTransactions, useCreditCards, useCreditCardTransactions, useMultiCardTransactions,
│                        #   useCreditCardMutations, useUpdateTransactionMcc, useUpdateCardTransaction, useCashbackRules,
│                        #   useCycleCashback, useNow, useListboxKeyboard,
│                        #   useDashboardStats, useBudgetAlerts, useDebounced, useCountUp, useAuth
├── lib/supabase.ts      # Supabase client singleton
├── lib/query-client.ts  # QueryClient dùng chung (AppHeader `.clear()` khi đăng xuất) — tách khỏi App.tsx vì file đó chỉ export component
├── services/            # supabase-js: accounts, account-mutations, creditCards, credit-card-mutations, cashbackRules,
│                        #   dashboard, exports, unparsed-messages; mappers (snake_case→camelCase + Zod),
│                        #   api-errors (toApiError), query-cursor (keyset cursor, sanitizeSearch), transactionQuery (filter)
├── stores/              # filterStore, dashboardStore, budgetStore, categoryOverrideStore, chatStore, themeStore
├── types/               # api.ts, account.ts, creditCard.ts, credit-card-form.ts, cashback.ts, cashback-form.ts,
│                        #   form-fields.ts (moneyAmountField), budget.ts, categories.ts
├── utils/               # dates, currency, categories, csv, billingCycle, mcc (+ mcc-codes sinh tự động, mcc-keywords,
│                        #   mcc-search), cashback, cashflow, category-colors,
│                        #   cycle-progress, group-by-day
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
               credit_limit, current_balance, statement_date (1..31), payment_due_date, last_updated,
               cashback_monthly_cap bigint|NULL (>0; trần hoàn tiền cả thẻ mỗi kỳ, NULL = không giới hạn)
               unique (user_id, bank_name, card_number)
card_cashback_rules  id, user_id, card_id → credit_cards (cascade), mcc text|NULL (NULL = rule mặc định),
               rate_percent numeric(5,2) 0..100, min_cycle_spend bigint, cap_per_cycle bigint|NULL (>0)
               unique nulls not distinct (card_id, mcc)   -- rate_percent + min_cycle_spend = BẬC NỀN
card_cashback_rule_tiers  id, user_id, rule_id → card_cashback_rules (cascade), min_spend bigint (>0),
               rate_percent numeric(5,2) 0..100, unique (rule_id, min_spend) — bậc THÊM, tối đa 5/rule
unparsed_messages  tin không ghi được: user_id NOT NULL, raw_text (thường là NFD), source, reason,
               suggested_kind (máy gợi ý: transaction|card_reminder|promo|unknown), kind (user chốt:
               normal|internal_transfer|cashback|card_reminder|promo), resolved, transaction_id → transactions
               RLS chính chủ: select + update CHỈ cột (resolved, kind, transaction_id); insert chỉ edge function.
               Trigger khoá tin đã resolved (bỏ resolved rồi resolve lại = giao dịch thứ 2)

transactions.kind  'normal'|'internal_transfer'|'cashback' — internal_transfer (chuyển giữa TK/thẻ của mình,
               gồm trả nợ thẻ) KHÔNG tính vào get_dashboard_stats
accounts       unique (user_id, bank_name, account_number), check mask '^\*{4}[^\s*]{4}$', user insert/delete được

transactions.mcc  text|NULL, 4 chữ số — USER gán tay (SMS ngân hàng VN không có MCC)
```

**RPC:** `get_dashboard_stats(p_date_from, p_date_to)` → JSON khớp `DashboardStatsSchema`.
`delete_credit_card(p_card_id)` → số giao dịch đã xoá: xoá thẻ **kèm toàn bộ giao dịch** nguyên tử (khoá dòng
thẻ trước), lỗi `P0002` nếu thẻ không tồn tại / của người khác. **Xoá thẻ luôn qua RPC này**, không `delete`
trần: FK `transactions.card_id` là `on delete set null` nên giao dịch thành mồ côi (xem cảnh báo bên dưới).
`save_cashback_rule(p_card_id, p_rule_id, p_mcc, p_rate, p_min, p_cap, p_tiers jsonb)` → id rule: lưu rule **và thay toàn bộ bậc**
trong một transaction (bậc tăng dần chặt, bậc đầu > `p_min`, ≤ 5 bậc, sai → `22023`; rule lạ → `P0002`). **Ghi rule hoàn tiền luôn
qua RPC này**; vì nó thay toàn bộ bậc nên mọi lời gọi phải gửi đủ danh sách bậc hiện có.
`delete_bank_account(p_account_id)` → như `delete_credit_card` cho TK. `resolve_unparsed(p_msg_id, p_kind, p_tx jsonb)` →
id giao dịch|null: kind normal/internal_transfer/cashback cần `p_tx` {amount ≠0 nguyên, transaction_date ISO **có offset**,
account_id XOR card_id, description?, merchant_name?, category? ∈ 6 Category}; bank_name/source_type lấy từ TK/thẻ;
card_reminder/promo không có p_tx. Lỗi 22023 (tham số / đã xử lý), P0002 (không thấy).
Cả năm RPC dùng `security invoker` để tôn trọng RLS — **không được đổi sang `security definer`**.

**RLS:** mọi bảng bật RLS, policy `auth.uid() = user_id`. `anon` bị `revoke all`.
`transactions` insert/update kiểm thêm `card_id`/`account_id` **thuộc chính user**; `card_cashback_rules`
insert/update kiểm thẻ thuộc user; `card_cashback_rule_tiers` kiểm rule thuộc user. Chỉ kiểm `user_id` là chưa đủ: FK vẫn chấp nhận trỏ sang thẻ của
người khác, và khi họ xoá thẻ thì giao dịch bị `set null` thành mồ côi.
`transactions.user_id` là **NOT NULL** — row user_id null sẽ vô hình với mọi policy
(`auth.uid() = null` → NULL) và không cách nào xoá từ client.

**Truy vấn giao dịch:** dùng `TX_COLUMNS` (`src/services/transactionQuery.ts`), **không dùng
`select('*')`** — `*` kéo cả `raw_text` (nguyên văn SMS: số dư, tên người chuyển) về browser
dù không mapper nào đọc. `countOption(cursor)` chỉ đếm ở trang đầu, vì `totalForPage()`
vứt bỏ count từ trang 2 trở đi. Cỡ trang "Xem thêm" của mọi danh sách giao dịch: `TX_PAGE_SIZE` (= 20, cùng file).
`getCreditCardTransactions(card: string | { cardIds })`: `cardIds` rỗng = mọi thẻ của user (RLS giới hạn); keyset
`(transaction_date, id)` vẫn đúng khi gộp nhiều thẻ.

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
Luồng: `normalizeInput` (**NFC** — iOS gửi NFD, regex NFC không khớp) → OTP → chống trùng (cùng `raw_text` trong 10 phút)
→ 19 regex parser → `withKind` (nhận diện chuyển nội bộ, `internal-transfer.ts`, secret `OWNER_NAMES`) → resolve TK/thẻ
(phải khớp DUY NHẤT) → insert; **không khớp TK/thẻ thì KHÔNG ghi giao dịch mồ côi** mà vào hộp tin (`reason = no_account`);
chống trùng kiểm cả `transactions` lẫn `unparsed_messages`;
không khớp → `unparsed_messages` kèm `source`, `reason`, `user_id`, `suggested_kind` (`classify-unparsed.ts`, ưu tiên recall:
giao dịch thật không bao giờ bị gắn promo). `ingest.ts` (parse/resolve FK/insert) dùng chung với `backfill-unparsed.ts`
(chạy tay, dry-run mặc định). Parser nhận `now` = thời điểm nhận tin cho tin không ghi ngày/năm.
Parser: LPBank (app + SMS), UOB, Sacombank, MoMo, BIDV (`parsers.ts`) + SHB, HDBank, MSB, VPBank, WOORIVN thẻ
(`parsers-card-sms.ts`) + BIDV push, Vietinbank, OCB TK/thẻ, SHB SAHA, HDBank TK, Cake thẻ, Sacombank Pay trả nợ
(`parsers-balance-notifications.ts`). Thứ tự mảng `parsers` quan trọng (khớp trước thắng). Secret check: `shortcut-auth.ts`.
**`OWNER_NAMES` hiện KHÔNG đặt trên production** (user quyết định): BIDV trả nợ thẻ tính là chi, chuyển giữa TK của mình
đếm cả thu lẫn chi — chỉ "THANH TOAN THE TIN DUNG" và Sacombank Pay trả nợ được gắn nội bộ.
Bank xác định bằng đuôi thẻ/TK đối chiếu `credit_cards` — không đoán theo giọng văn.
Thứ tự deploy với migration 20261021100000: db push rồi deploy function ngay (function cũ không ghi user_id).

**Giới hạn `text` 2000 ký tự (`MAX_TEXT_LENGTH`) — không được bỏ.** Regex parser chạy đồng bộ
và có độ phức tạp phi tuyến với input dài (đo thật: 203KB = 8.665ms trước khi neo regex SHB).
Thông báo ngân hàng thật < 500 ký tự. Khi viết parser mới: **không dùng `.*?` / `.+?` không neo**,
dùng `[^\n]{0,N}?` để chặn backtracking.

Secret so sánh bằng hash SHA-256 + XOR toàn bộ (constant-time), không dùng `!==`.
Response **không** trả `raw_text` về client.
Test: `docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app denoland/deno:2.1.4 test --allow-all` (mọi file test)

## State Management (`src/stores/`)

| Store | Persisted | Description |
|---|---|---|
| `filterStore` | No | accountId, cardId, cardIds (mục "Nhiều thẻ"), dateFrom, dateTo, searchQuery, txType, category. `resetFilters` reset `cardIds` như `cardId` |
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
| `useMultiCardTransactions()` | Infinite query cho "Nhiều thẻ", đọc `filterStore.cardIds`. QueryKey **phải** bắt đầu bằng `['creditCardTransactions']` để optimistic patch MCC và invalidate khi sửa/xoá thẻ vẫn áp dụng |
| `useCountUp(target, durationMs = 600)` | Số chạy tăng dần tới `target`; `prefers-reduced-motion` → trả `target` ngay |
| `useCreateCreditCard()` / `useUpdateCreditCard(card)` / `useDeleteCreditCard()` | Mutations; invalidate thẻ, giao dịch thẻ, dashboard, rule, chi tiêu chu kỳ |
| `useCardTransactionCount(cardId)` | Đếm giao dịch của thẻ (luôn lấy mới) cho dialog xoá |
| `useUpdateTransactionMcc()` | Gán/bỏ MCC, optimistic ở mọi trang cache, hoàn tác đúng giao dịch khi lỗi |
| `useUpdateCardTransaction()` | Sửa giao dịch thẻ (patch chỉ gồm trường đã đổi); invalidate giao dịch thẻ, chi tiêu chu kỳ, dashboard |
| `useListboxKeyboard(count, onSelect, spaceSelects?)` | Con trỏ + phím mũi tên/Home/End/Enter cho ô tìm điều khiển listbox (CardSearchListbox, MccPicker) |
| `useCashbackRules(cardId)` / `useSaveCashbackRule` / `useDeleteCashbackRule` | Rule hoàn tiền của thẻ (kèm bậc thang) |
| `useSetCardCashbackCap(cardId)` | Đặt/bỏ trần hoàn tiền cả thẻ; invalidate `['creditCards']` |
| `useCycleCashback(cardId, cycle, cardCap)` | `{ result, rules, isLoading, isError, refetch }` — rule + chi tiêu chu kỳ + trần thẻ → `computeCashback` |
| `useNow(intervalMs = 60000)` | Thời điểm hiện tại (ISO) tự cập nhật — để chu kỳ sao kê sang kỳ mới khi tab mở qua mốc cắt |
| `useDashboardStats()` | Current + previous month stats (month-over-month delta) |
| `useBudgetAlerts(breakdown, budgets)` | `{ alerts, warningCount, overbudgetCount }` — fires Sonner toasts |
| `useDebounced(value, delayMs)` | Debounced value |
| `useUnparsedMessages(includePromo)` / `useUnparsedCount()` / `useResolveUnparsed()` | Hộp tin chưa phân loại (200 tin mới nhất, không phân trang) |
| `useCreateAccount()` / `useUpdateAccount(a)` / `useDeleteAccount()` / `useAccountTransactionCount(id)` | CRUD tài khoản ngân hàng |

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
CashbackRule { id, cardId, mcc: string | null, ratePercent, minCycleSpend, capPerCycle: number | null, tiers: { minSpend, ratePercent }[] }
CashbackResult { total, uncappedTotal, cardCap, cardCapped, byRule: RuleCashback[], unmatchedSpend }
// CreditCard cũng có cashbackMonthlyCap: number | null

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
formatTransactionForCSV(tx, accountOrCard?, overrides?)  → CSVTransactionRow   // có cột 'Dòng tiền' (Nội bộ/Cashback)
downloadCSV(csvString, filename)                         // UTF-8 BOM download
```

### Billing Cycle (`billingCycle.ts`)
```typescript
computeCurrentCycle(statementDay, nowISO)         → BillingCycle   // ngày sao kê 29-31 được KẸP vào độ dài tháng
groupTransactionsByCycle(txs, currentCycle, statementDay) → BillingCycleGroupData[]   // mỗi giao dịch vào chu kỳ CHỨA ngày giao dịch (không dồn vào kỳ hiện tại)
formatCycleDateRange(startISO, endISO)            → { startDisplay, endDisplay }
cycleProgressPercent(startISO, endISO, nowISO)    → number      // cycle-progress.ts
cycleUrgency(daysUntilClose)                      → 'calm' | 'soon' | 'urgent'   // ≤3 ngày = urgent, ≤7 = soon
```
Chu kỳ là khoảng **nửa mở `[startISO, endISO)`**; truy vấn dùng `dateFrom` + `dateBefore` (cận trên loại trừ).

### Dashboard & danh sách (`cashflow.ts`, `group-by-day.ts`)
```typescript
computeNetFlow(totalIncome, totalExpense) → { net, spendRatio | null }   // nhận số DƯƠNG từ RPC; spendRatio null khi không có thu
groupByDay(items)                         → DayGroup[] { dayKey, income, expense, items }   // theo ngày VN, tổng chỉ của dòng ĐÃ TẢI, không gồm internal_transfer (khớp dashboard)
formatDayLabel(dayKey, nowISO)            → "Hôm nay" | "Hôm qua" | "Thứ hai, 05/10/2026"
getCategoryChartColor(category)           → 'var(--chart-n)'   // danh mục lạ → màu "Khác"
```

### MCC (`mcc.ts`, `mcc-search.ts`)
```typescript
MCC_OPTIONS                       // ~1000 mã ISO 18245 {code, label, keywords} từ mcc-codes.ts (FILE SINH: sửa scripts/generate-mcc-codes.py)
COMMON_MCC_OPTIONS                // mã có từ khoá gợi ý (mcc-keywords.ts) — hiện sẵn khi ô tìm trống
suggestMcc(merchantName)          → mã | null   // chỉ GỢI Ý, không bao giờ tự lưu; ranh giới từ, từ khoá dài nhất thắng, hoà → mã nhỏ hơn
getMccLabel(code) / formatMcc(code)   // "5411 · Siêu thị"
searchMcc(query, limit = 50)      → MccOption[]   // mã > đầu mã > chữ (mã nhóm chung trước mã hãng 3000–3999)
getMccGroup(code)                 → "Bán lẻ, ô tô, xăng dầu"
```
Chọn MCC luôn qua `MccPicker` (không `<select>` nghìn option). Mã 4 chữ số ngoài danh sách vẫn hợp lệ (giao dịch lẫn rule).

### Cashback (`cashback.ts`)
```typescript
computeCashback(rules, txs, cardCap = null) → { total, uncappedTotal, cardCap, cardCapped, byRule, unmatchedSpend }
```
Chỉ tính giao dịch chi; mỗi giao dịch vào 1 rule (MCC trùng → rule mặc định → unmatched); ngưỡng, bậc thang và trần áp **riêng từng rule**:
lấy **bậc cao nhất có `minSpend ≤ chi`** (bậc nền + `tiers`, tự sắp xếp) và áp % của bậc đó cho **cả khoản chi** (không lũy tiến → có
"vách đá": 9.999.999đ ≠ 10.000.000đ). Trần rule cắt trước, **trần cả thẻ cắt sau** khi cộng các rule. Làm tròn xuống trên tổng rule bằng **điểm cơ bản nguyên** (số thực sai 1đ: 0,57% × 1.000.000 → 5.699). Luôn hiển thị là "ước tính".

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
- Sau khi thêm test, **phá code có chủ đích** (mutation thủ công) để chắc test thật sự bắt được lỗi. **Sao lưu file trước** và khôi phục
  từ bản sao. **Không** `git checkout <file>` để khôi phục: nó xoá mất thay đổi chưa commit.
- **Test UI timeout trên máy đang tải cao** thường do tranh CPU khi vitest chạy song song mặc định. Chạy `--maxWorkers=6` để phân biệt
  timeout do tải với lỗi thật.

Integration hộp tin seed `unparsed_messages` bằng service_role **local**: thêm `VITE_TEST_SERVICE_ROLE_KEY` (SERVICE_ROLE_KEY của
`supabase status -o env`) vào `.env.test.local` — file chỉ nạp ở mode test, không vào bundle.

**RLS chéo 2 user** (integration chỉ có 1 test user): `supabase/tests/card-crud-rls.sql`, `card-cashback-tiers-rls.sql`, `unparsed-accounts-rls.sql` chạy trên Postgres 17 tạm
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

- **Chỉ deploy qua GitHub Actions, SAU khi CI xanh** (`.github/workflows/ci.yml`): job `verify` (lint, unit, build,
  Deno check + test parser) → job `deploy` (`needs: verify`) bằng Vercel CLI. Push `main` → production; PR → preview
  (bỏ qua PR từ fork). Git Integration của Vercel **tắt** (`"git": { "deploymentEnabled": false }` trong `vercel.json`)
  — bật lại là Vercel deploy song song, không chờ CI.
- GitHub secrets bắt buộc: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (`vercel link` → `.vercel/project.json`).
  Thiếu thì job deploy fail rõ ràng (không deploy gì).
- Integration test không chạy ở CI (cần stack Supabase + seed bị gitignore) → chạy local trước khi merge.
- Install: `npm ci`; Build: `tsc -b && vite build` → `dist/`; Region: `sfo1`
- Env: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` đặt trong Vercel dashboard. Job deploy dùng `vercel deploy`
  (**build trên Vercel**), KHÔNG `vercel pull` + `--prebuilt`: biến loại Sensitive không kéo về được (`vercel pull` ghi
  `"[SENSITIVE]"`), build trên runner đóng gói chuỗi đó làm URL → production trắng trang "Invalid supabaseUrl" (2026-10-21).
  `vite.config.ts` làm `vite build` FAIL khi `VITE_SUPABASE_URL` không phải URL http(s) hợp lệ.
