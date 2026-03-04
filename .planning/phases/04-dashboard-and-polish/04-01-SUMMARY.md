---
phase: 04-dashboard-and-polish
plan: "01"
subsystem: dashboard
tags: [dashboard, stats, zustand, tanstack-query, msw, responsive, vietnamese-ui]
dependency_graph:
  requires: [filterStore pattern, MSW handlers pattern, TanStack Query pattern]
  provides: [DashboardPage at /dashboard, useDashboardStats hook, dashboardStore, getDashboardStats service]
  affects: [App.tsx routing, AppHeader navigation]
tech_stack:
  added: []
  patterns: [independent-zustand-store, zod-boundary-validation, responsive-date-picker]
key_files:
  created:
    - src/services/dashboard.ts
    - src/hooks/useDashboardStats.ts
    - src/stores/dashboardStore.ts
    - src/features/dashboard/StatCard.tsx
    - src/features/dashboard/StatCardSkeleton.tsx
    - src/features/dashboard/SourceSubtotals.tsx
    - src/features/dashboard/DashboardDatePicker.tsx
    - src/pages/DashboardPage.tsx
  modified:
    - src/mocks/handlers.ts
    - src/App.tsx
    - src/components/layout/AppHeader.tsx
decisions:
  - "Dashboard uses independent dashboardStore (not filterStore) — users can compare dashboard period to transaction list period without switching views"
  - "MSW /api/dashboard/stats includes all CC statuses (pending + posted) per CONTEXT.md decision"
  - "DashboardDatePicker uses native inputs on mobile (sm:hidden) and Calendar popover on desktop (hidden sm:flex) for touch-friendly UX"
  - "Chart placeholder div (id=dashboard-chart-slot) reserved in three-column grid for 04-02 implementation"
metrics:
  duration: "7 min"
  completed_date: "2026-03-04"
  tasks_completed: 4
  tasks_total: 4
  files_created: 8
  files_modified: 3
---

# Phase 4 Plan 01: Dashboard Page — Income/Expense Stat Cards Summary

**One-liner:** Dashboard page at /dashboard with independent date-filtered income/expense stat cards aggregating bank + CC data via MSW endpoint and Zustand store separate from filterStore.

## What Was Built

A complete DashboardPage with:
- Independent `dashboardStore` Zustand store (dateFrom/dateTo, setDateRange, resetDateRange) — completely separate from main `filterStore`
- `getDashboardStats` service with Zod validation calling GET /api/dashboard/stats
- `useDashboardStats` TanStack Query hook with `queryKey: ['dashboardStats', { dateFrom, dateTo }]`
- MSW handler at `/api/dashboard/stats` aggregating all mockTransactions + mockCreditCardTransactions, filtered by date range, returning totalIncome, totalExpense, bankIncome, bankExpense, ccExpense, categoryBreakdown, transactionCount
- `StatCard` component (income/expense variants) with TrendingUp/TrendingDown icons, green/red colors, formatVND, error state with retry button (min-h-[44px]), empty state with Vietnamese message
- `StatCardSkeleton` matching card dimensions for loading state
- `SourceSubtotals` showing bank/CC breakdown below main total
- `DashboardDatePicker` — responsive: native `<input type="date">` on mobile (sm:hidden), Calendar popover on desktop (hidden sm:flex), all interactive elements ≥48px
- `DashboardPage` with three-column grid (lg:grid-cols-3), chart slot placeholder (id=dashboard-chart-slot)
- `/dashboard` route added to App.tsx
- "Tổng quan" NavLink added before "Ngân hàng" in AppHeader with active highlighting

## Deviations from Plan

None — plan executed exactly as written.

## Requirements Progress

- DASH-01: Income/expense totals visible for selected period — SATISFIED
- UX-01: Responsive layout and 48px tap targets — PARTIALLY SATISFIED (04-02 completes with chart and full mobile audit)

## Self-Check

- [x] src/services/dashboard.ts — exists (35 lines)
- [x] src/hooks/useDashboardStats.ts — exists (13 lines)
- [x] src/stores/dashboardStore.ts — exists (25 lines)
- [x] src/features/dashboard/StatCard.tsx — exists (57 lines)
- [x] src/features/dashboard/StatCardSkeleton.tsx — exists (17 lines)
- [x] src/features/dashboard/SourceSubtotals.tsx — exists (20 lines)
- [x] src/features/dashboard/DashboardDatePicker.tsx — exists (91 lines)
- [x] src/pages/DashboardPage.tsx — exists (72 lines)
- [x] /dashboard route in App.tsx — verified
- [x] "Tổng quan" NavLink in AppHeader — verified
- [x] Zero TypeScript errors — npx tsc --noEmit exits 0
- [x] All 15 tests pass — npx vitest run exits 0

## Self-Check: PASSED

All files verified present, all commits verified in git log.

## Commits

| Hash | Message |
|------|---------|
| 095a1fc | feat(04-01): add dashboard data layer — MSW handler, service, store, and hook |
| 1813821 | feat(04-01): add StatCard components and DashboardDatePicker |
| d2df2a4 | feat(04-01): add DashboardPage, /dashboard route, and Tổng quan nav link |
| 7014764 | feat(04-01): add DashboardPage with income/expense stat cards and responsive layout (visual verify approved) |
