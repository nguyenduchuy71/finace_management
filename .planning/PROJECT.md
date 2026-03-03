# FinanceManager — Quản Lý Tài Chính Cá Nhân

## What This Is

A personal finance dashboard (React + TypeScript frontend) where users see all their bank and credit card transactions in one place with powerful filtering and search. Currently shipped v1.0 MVP with complete transaction viewing, account switching, and an AI-powered chatbot for transaction analysis. Data comes from a third-party API (mock API in development) and displays by date, type, and billing cycle. Built for Vietnamese users managing multi-account finances.

## Core Value

Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.

## Requirements

### Validated

- ✓ Người dùng có thể xem danh sách giao dịch ngân hàng (BANK-01, BANK-02, BANK-04) — v1.0
- ✓ Người dùng có thể chuyển đổi tài khoản và xem giao dịch của từng account (BANK-03) — v1.0
- ✓ Người dùng có thể xem danh sách giao dịch thẻ tín dụng với trạng thái pending/posted (CC-01, CC-02) — v1.0
- ✓ Người dùng có thể lọc giao dịch theo ngày, loại, tài khoản với khả năng tìm kiếm (FILTER-01, FILTER-02, FILTER-03, FILTER-04) — v1.0
- ✓ Tất cả danh sách hiển thị skeleton, error, empty state theo đúng async flow (DASH-03) — v1.0
- ✓ Người dùng có thể yêu cầu chatbot phân tích giao dịch (ChatBot feature, OpenAI-compatible API) — v1.0

### Active (v1.1+)

- [ ] Người dùng có thể xem ngày sao kê và chu kỳ sao kê thẻ tín dụng (CC-03, CC-04) — Phase 3
- [ ] Người dùng có thể xem dashboard tổng quan (số dư, tổng thu, tổng chi) (DASH-01, DASH-02) — Phase 4
- [ ] Responsive layout hoàn chỉnh trên mobile và desktop (UX-01) — Phase 4

### Out of Scope

- Backend / server-side logic — frontend only, gọi API bên thứ 3
- Multi-user authentication — dùng cá nhân, không cần complex auth
- Thanh toán / chuyển tiền — chỉ đọc (read-only), không thực hiện giao dịch
- Mobile app native — web responsive, không build app riêng

## Context

- **Stack**: Frontend only (React + TypeScript), không có backend riêng
- **API Integration**: Gọi API bên thứ 3 để lấy dữ liệu giao dịch; dùng mock API trong development để dễ test
- **Data model**: Tài khoản ngân hàng (bank account) + thẻ tín dụng (credit card), mỗi loại có giao dịch và thông tin sao kê
- **Scope**: Personal finance dashboard — read-only, hiển thị và tổ chức data

## Constraints

- **Tech Stack**: Frontend only — React, TypeScript, không có backend riêng
- **API**: Gọi external API bên thứ 3, cần xử lý CORS, loading state, error state
- **Performance**: Cần xử lý pagination nếu số lượng giao dịch lớn
- **Responsive**: Phải xem được trên cả desktop lẫn mobile

## Context

**v1.0 Shipped:** 2026-03-03
- **Tech Stack:** React 19 + TypeScript 5.9, Tailwind CSS v4 + shadcn/ui, TanStack Query v5 + Zustand v5, React Router v7
- **Codebase:** ~4,481 LOC, 8 plans (2 phases), 26 tasks
- **Key Patterns:** MSW deferred render guard, QueryClient locked config, filter state in TanStack Query key, Zustand v5 double-curry selectors with useShallow
- **User Testing:** 9 manual verification items documented in VERIFICATION.md (live browser testing recommended before production)

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
| ChatBot with OpenAI-compatible API | Enable user-configured API endpoint | ✓ Implemented — localStorage-persisted config, transaction context sent with request |

## Blockers / Concerns

**Still Open:**
- Real third-party banking API schema unknown — fixtures built to best-guess shape; VND format (integer string vs number) must be verified when real API docs arrive
- Billing cycle API contract unknown — Phase 3 assumes `statementDate`, `billingCycleStart`, `billingCycleEnd` fields; if absent, fallback UI design needed

**Resolved:**
- Vite scaffold in non-empty directory ✓ (workaround: temp dir + mv)
- shadcn requires Tailwind pre-installed ✓ (installed before shadcn init)
- TypeScript validator reads root tsconfig.json ✓ (added compilerOptions.paths)
- Vitest strict mode TypeScript ✓ (defineConfig from vitest/config, not vite)

---
*Last updated: 2026-03-03 after v1.0 milestone completion*
