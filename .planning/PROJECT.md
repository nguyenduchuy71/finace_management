# FinanceManager — Quản Lý Tài Chính Cá Nhân

## What This Is

A personal finance dashboard (React + TypeScript frontend) where Vietnamese users see all their bank and credit card transactions in one place with powerful filtering, search, billing cycle grouping, and an AI-powered chatbot for financial insights. Data comes from a third-party API (MSW mock in development) and is organized by date, type, and billing cycle. Deployed to Vercel as a read-only personal finance tool.

## Core Value

Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.

## Requirements

### Validated

- ✓ Project scaffolded with Vite + React 19 + TypeScript strict + Tailwind CSS v4 + shadcn/ui (FOUND-01) — v1.0
- ✓ MSW 2.x mock API returns realistic Vietnamese banking fixture data (FOUND-02) — v1.0
- ✓ Zod schema validation for all API responses at service boundary (FOUND-03) — v1.0
- ✓ TanStack Query v5 for server state, Zustand v5 for UI state (FOUND-04, FOUND-05) — v1.0
- ✓ Người dùng có thể xem danh sách giao dịch ngân hàng với infinite-scroll pagination (BANK-01, BANK-02, BANK-04) — v1.0
- ✓ Người dùng có thể chuyển đổi tài khoản và xem giao dịch của từng account (BANK-03) — v1.0
- ✓ Người dùng có thể xem danh sách giao dịch thẻ tín dụng với trạng thái pending/posted (CC-01, CC-02) — v1.0
- ✓ Người dùng có thể xem thông tin chu kỳ sao kê thẻ tín dụng (ngày sao kê, countdown, grouping) (CC-03, CC-04) — v1.0
- ✓ Người dùng có thể lọc giao dịch theo ngày, loại, tài khoản, và tìm kiếm văn bản (FILTER-01–04) — v1.0
- ✓ Người dùng có thể xem dashboard: tổng thu/chi, biểu đồ danh mục Recharts (DASH-01, DASH-02) — v1.0
- ✓ Tất cả async states: loading skeleton, error state, empty state (DASH-03) — v1.0
- ✓ Responsive layout trên mobile và desktop, WCAG AA touch targets (UX-01) — v1.0
- ✓ Số tiền VND format đúng: `đ 1.500.000` (UX-02) — v1.0
- ✓ Người dùng có thể yêu cầu chatbot phân tích giao dịch via Anthropic SDK (ChatBot) — v1.0
- ✓ App deployed to Vercel with production MSW guard — v1.0

### Active (v1.1+)

- [ ] Kết nối với real third-party banking API (thay MSW mock) — API-01
- [ ] Serverless proxy (Vercel Function) để xử lý CORS và bảo vệ API key — API-02
- [ ] Người dùng có thể xuất danh sách giao dịch ra CSV — EXP-01
- [ ] Budget tracking: đặt ngân sách theo danh mục và xem cảnh báo khi vượt — BUDGET-01
- [ ] So sánh chi tiêu tháng này vs tháng trước trên dashboard — DASH-V2-01
- [ ] Cải thiện chatbot UX: cleaner message display, better settings UI — CHAT-UX-01
- [ ] Thêm thông báo khi số dư tài khoản thấp hoặc sắp đến ngày sao kê — NOTIF-01

### Out of Scope

- Backend / server-side logic — frontend only, gọi API bên thứ 3
- Multi-user authentication — dùng cá nhân, không cần complex auth
- Thanh toán / chuyển tiền — chỉ đọc (read-only), không thực hiện giao dịch
- Mobile app native — web responsive, không build app riêng
- Real-time WebSocket updates — refresh khi cần, không cần live updates
- PDF export — CSV đủ dùng cho v1.1, PDF dành cho v2.0 nếu có nhu cầu

## Context

- **Stack**: Frontend only (React + TypeScript), không có backend riêng
- **API Integration**: MSW mock in development; real API integration planned for v1.1
- **Data model**: Tài khoản ngân hàng (bank account) + thẻ tín dụng (credit card), mỗi loại có giao dịch và thông tin sao kê
- **Scope**: Personal finance dashboard — read-only, hiển thị và tổ chức data

**v1.0 Shipped:** 2026-03-04 — Deployed to Vercel
- **Tech Stack:** React 19 + TypeScript 5.9, Tailwind CSS v4 + shadcn/ui (New York), TanStack Query v5 + Zustand v5, React Router v7, Anthropic SDK, Recharts 3.7
- **Codebase:** ~7,478 LOC, 19 plans (6 phases), 125 commits
- **Key Patterns:** MSW deferred render guard, QueryClient locked config (staleTime=5min), filter state in queryKey, Zustand v5 double-curry with useShallow, billing cycle UTC+7 boundary constants
- **Known Tech Debt:** Real API schema unknown (VND format to verify), billing cycle fields may differ from mock contract, main bundle 525KB (target was <500KB)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Frontend-only | Đơn giản hóa stack, không cần backend | ✓ Verified — API integration points clear, no backend bottleneck |
| Mock API with MSW | Cho phép build UI mà không cần API thật | ✓ Success — rapid iteration, deferred render guard prevents hydration mismatch |
| React Router v7 layout routes | Avoid header re-mount on navigation | ✓ Applied — AppShell as layout route, clean page transitions |
| Filter state in TanStack Query key | Ensure auto-refetch on any filter change | ✓ Applied — queryKey includes all filter params, no manual refetch triggers |
| Zustand v5 double-curry with useShallow | Prevent infinite re-render from new object refs | ✓ Applied — filters, theme, chat store all use double-curry pattern |
| Dark mode FOUC prevention | Apply dark class to documentElement on module load | ✓ Applied — no flash of unstyled content on page refresh |
| Cursor pagination with undefined sentinel | TanStack Query v5 requirement | ✓ Applied — getNextPageParam returns undefined (not null) for last page |
| Billing cycle boundary at 17:00 UTC | 17:00 UTC = midnight Vietnam (UTC+7) | ✓ Applied — all cycle timestamps use Date.UTC(y, m, d, 17, 0, 0) |
| Independent dashboardStore | Dashboard period ≠ transaction filter period | ✓ Applied — users compare dashboard vs transaction list without interference |
| Anthropic SDK dangerouslyAllowBrowser: true | Anthropic allows browser CORS as of 2025 | ✓ Applied — no proxy needed for v1.0 |
| ChatBot with Anthropic SDK | Replace OpenAI-compatible stub with official SDK | ✓ Implemented — streaming via messages.stream() + finalMessage() pattern |
| Typing indicator over streaming | Simpler state management, avoids partial-text in store | ✓ Applied — isLoading=true, finalMessage() called once on completion |
| VITE_ENABLE_MSW env guard | Explicit opt-out of MSW at build time | ✓ Applied — dual guard: import.meta.env.DEV AND VITE_ENABLE_MSW !== 'false' |
| esbuild as Vite minifier | terser not installed; esbuild equivalent for this scale | ✓ Accepted — no meaningful difference for this bundle size |
| touch-target utility class | WCAG AA compliance (44px min) across app | ✓ Applied — replaces inline min-h-[44px] pattern consistently |

## Blockers / Concerns

**Still Open:**
- Real third-party banking API schema unknown — fixtures built to best-guess shape; VND format (integer string vs number) must be verified when real API docs arrive
- Billing cycle API contract unknown — assumes `statementDate`, `billingCycleStart`, `billingCycleEnd` fields; if absent, fallback UI design needed for v1.1

**Resolved:**
- Vite scaffold in non-empty directory ✓ (workaround: temp dir + mv)
- shadcn requires Tailwind pre-installed ✓ (installed before shadcn init)
- TypeScript validator reads root tsconfig.json ✓ (added compilerOptions.paths)
- Vitest strict mode TypeScript ✓ (defineConfig from vitest/config, not vite)

---
*Last updated: 2026-03-08 after v1.0 milestone completion*
