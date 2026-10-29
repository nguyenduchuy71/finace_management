# CLAUDE.md — FinanceManager Project Reference

## Overview

Personal finance dashboard (React + TypeScript + Vite) for managing bank accounts and credit card transactions, kèm quản lý thẻ (thêm/sửa/xoá), gán MCC cho giao dịch thẻ và hoàn tiền ước tính theo rule của từng thẻ (`docs/credit-card-cashback.md`). Backed by **Supabase** (Postgres + Auth + RLS + Edge Functions). Giao dịch được nạp tự động từ thông báo SMS/push của ngân hàng qua iOS Shortcut → Edge Function `parse-transaction`; mỗi giao dịch ghi thành công trừ 1 **credit** (RPC `ingest_transaction` nguyên tử, hết credit thì tin được giữ, nạp lại thì replay — xem `docs/claude/database-schema.md`). Giao diện thương hiệu **"Ví Jade"** (sáng/tối, xem [Styling](#styling--ví-jade)).

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

---

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

Edge function secrets (`supabase secrets set`): chỉ còn cho đường **legacy** single-tenant — `SHORTCUT_SECRET`, `DEFAULT_USER_ID`,
`OWNER_NAMES` (gỡ ở phase 4 của `plans/261027-1012-saas-signup-api-key-credits/`). User mới xác thực bằng API key riêng.
Thanh toán (phase 3, xem `docs/claude/edge-functions.md`): `MOMO_PARTNER_CODE/ACCESS_KEY/SECRET_KEY`, `ZALOPAY_APP_ID/KEY1/KEY2`, `PAYMENT_ENV=sandbox|production`,
`PAYMENT_RETURN_URL` (https://<domain>/payment/return), `RECONCILE_SECRET`. Ví thiếu secret → ẩn + 503; production + key sandbox công khai → ví tắt.

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
/              → LandingPage (public, giới thiệu sản phẩm; đã đăng nhập → /accounts)
/dashboard     → DashboardPage
/accounts      → BankAccountsPage ("Giao dịch ngân hàng": ?view=inbox|recorded — hộp tin chưa phân loại / giao dịch theo TK)
/credit-cards  → CreditCardsPage (?view=all = "Nhiều thẻ"; mặc định "Từng thẻ")
/settings      → SettingsPage (số dư + lịch sử credit, nạp credit MoMo/ZaloPay + lịch sử đơn, API key cho Shortcut, tên chủ TK, xoá tài khoản)
/payment/return → PaymentReturnPage (?order=<id>; ví đưa user về; CHỈ hiển thị + poll trạng thái đơn, không bao giờ cộng credit)
/signup        → SignupPage (public; ô đồng ý xử lý dữ liệu -> metadata privacy_policy_version)
/admin         → AdminPage (lazy chunk; chỉ admin — `useIsAdmin()`; nội dung sau MfaGate TOTP). User thường -> /accounts
```

Điều hướng: `src/components/layout/nav-items.ts` là **nguồn duy nhất** cho header (≥ `sm`) và thanh tab dưới `MobileTabBar` (< `sm`).
`visibleNavItems(isAdmin)` lọc mục `adminOnly`; `shortLabel` cho tab điện thoại khi nhãn dài (5 cột ở 360px ≈ 65px/cột —
"Thẻ tín dụng" xuống 2 dòng), kèm `aria-label` = nhãn đầy đủ.

All routes wrapped in `<AppShell>` (header + layout + chat button/panel).

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
12. **Credit nguyên tử:** giao dịch từ parser/backfill chỉ ghi qua RPC `ingest_transaction` (insert + trừ 1 credit cùng transaction, khoá `FOR UPDATE`
    hàng số dư); không `.from('transactions').insert` trong edge function. Client chỉ ĐỌC số dư/sổ cái. Chủ app đặt `credit_balances.unlimited` bằng SQL.

---

## Tài liệu chi tiết (tự nạp qua `@import`)

Mỗi file < 200 dòng. Sửa nội dung ở file tương ứng, không chép lại vào đây.

- @docs/claude/project-structure-and-state.md — cấu trúc `src/`, store, hook, type
- @docs/claude/database-schema.md — bảng, RPC, RLS, truy vấn giao dịch
- @docs/claude/edge-functions.md — `parse-transaction`, `admin`
- @docs/claude/utilities.md — `src/utils/*`
- @docs/claude/testing-and-deployment.md — test (unit/integration/SQL RLS), deploy Vercel
