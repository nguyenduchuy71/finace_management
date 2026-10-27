<!-- Tách từ CLAUDE.md (import bằng @). Cấu trúc thư mục, store, hook, type. -->

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
│   ├── settings/        # ApiKeysSection, CreateApiKeyDialog (key hiện 1 lần, chặn Esc/X), OwnerNamesSection,
│   │                    #   DeleteAccountSection, SuspendedBanner (AppShell — user bị khoá thấy app TRỐNG vì RLS)
│   ├── admin/           # AdminUsersList, AdminUserDialog (chỉ metadata), AdminActionDialog (lý do 5..500), AdminAuditList,
│   │                    #   SuspensionBadge (Hoạt động / Bị khoá / Lệch trạng thái)
│   ├── landing/         # LandingPage + Header/Hero/Features/HowItWorks/Security (trang chủ công khai, số liệu minh hoạ tĩnh)
│   └── auth/            # AuthProvider (xoá cache khi đổi user / mất phiên), LoginPage (báo riêng user_banned), SignupPage,
│                        #   ProtectedRoute, MfaGate + mfa.ts (TOTP; `supabase.auth.mfa` chỉ ở đây)
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
| `useApiKeys()` / `useCreateApiKey()` / `useRevokeApiKey()` | API key cho Shortcut; `mutateAsync` của tạo trả key đầy đủ (không toast key) |
| `useUserSettings()` / `useUpdateOwnerNames()` / `useDeleteMyAccount()` | Cài đặt user (gồm `suspendedAt`); xoá tài khoản qua edge function `delete-account` rồi `queryClient.clear()` |
| `useIsAdmin()` / `useAdminUsers()` / `useAdminUser(id)` / `useAdminAudit()` / `useAdminMutation()` | Trang quản trị. **Không refetch khi focus**: mỗi `get_user` ghi audit `view_user`. Sau thao tác chỉ tải lại danh sách + nhật ký và chép dòng mới vào cache chi tiết — KHÔNG gọi lại `get_user` |

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
