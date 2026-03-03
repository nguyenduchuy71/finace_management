---
phase: "02"
plan: "02-02"
subsystem: "app-shell"
tags: [routing, dark-mode, layout, navigation, zustand, react-router]
dependency_graph:
  requires: ["02-01"]
  provides: ["app-shell", "theme-store", "routing", "page-stubs"]
  affects: ["02-03", "02-04"]
tech_stack:
  added: []
  patterns:
    - "AppShell layout pattern with React Router Outlet"
    - "Zustand theme store with immediate DOM class application (no FOUC)"
    - "NavLink active state styling with Tailwind conditional classes"
key_files:
  created:
    - src/stores/themeStore.ts
    - src/components/layout/AppHeader.tsx
    - src/components/layout/AppShell.tsx
    - src/pages/BankAccountsPage.tsx
    - src/pages/CreditCardsPage.tsx
  modified:
    - src/App.tsx
    - src/index.css
decisions:
  - "Apply dark class to document.documentElement immediately on module load to prevent FOUC — same pattern as shadcn/ui recommendations"
  - "AppShell uses React Router Outlet so all nested routes inherit header/layout"
  - "Theme persisted to localStorage under finance-theme key — consistent with other app preferences"
  - "Route structure: / redirects to /accounts with Navigate replace to avoid back-button trap"
metrics:
  duration: "15 min"
  completed: "2026-03-03"
  tasks: 6
  files: 7
---

# Phase 02 Plan 02-02: App Shell, Routing, Dark Mode & Visual Design Summary

**One-liner:** React Router v7 app shell with Zustand-powered dark mode toggle, sticky NavLink header, and page route stubs ready for feature development.

## What Was Built

Replaced the flat Phase 1 POC App.tsx with a production-ready application shell. The shell consists of:

- **`themeStore.ts`** — Zustand store managing `light | dark` theme. Applies `dark` class to `document.documentElement` on module initialization (preventing FOUC) and on every toggle. Persists to localStorage.
- **`AppHeader.tsx`** — Sticky header with Wallet brand logo, NavLink navigation (active state highlighted), and Sun/Moon theme toggle button. All interactive elements have 44px minimum touch targets.
- **`AppShell.tsx`** — Full-height layout wrapper rendering AppHeader + `<Outlet />` for nested routes.
- **`BankAccountsPage.tsx` / `CreditCardsPage.tsx`** — Minimal route stubs with headings. Plans 02-03 and 02-04 will populate these.
- **`App.tsx`** — Rewritten with `<Routes>` wrapping AppShell, `/accounts` and `/credit-cards` routes, and a default `/` redirect to `/accounts`.
- **`index.css`** — Added `color-scheme: dark`, body transition for smooth theme changes, custom dark scrollbar styles, `min-height: 100vh`, and font anti-aliasing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T01 | Zustand theme store | ee1e90a | src/stores/themeStore.ts |
| T02 | index.css dark mode styles | ba56215 | src/index.css |
| T03 | AppHeader component | d97a095 | src/components/layout/AppHeader.tsx |
| T04 | AppShell layout | bd1d7c5 | src/components/layout/AppShell.tsx |
| T05 | Page route stubs | d5fad17 | src/pages/BankAccountsPage.tsx, src/pages/CreditCardsPage.tsx |
| T06 | App.tsx rewrite | 22bcca1 | src/App.tsx |

## Verification Results

All 15 file/content checks passed. `npx tsc --noEmit` exits with zero errors.

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Apply dark class immediately on module load** — `applyTheme(initialTheme)` is called at module scope before the store is created. This ensures the DOM has the correct class before React renders any components, preventing any flash of unstyled content.

2. **Route structure with Navigate replace** — `<Route index element={<Navigate to="/accounts" replace />} />` uses `replace` to avoid adding an extra history entry when landing on `/`, which would cause the back button to redirect to `/accounts` again.

3. **AppShell as layout route** — Using `<Route element={<AppShell />}>` as a parent route means AppHeader renders once and all child pages share the same layout without re-mounting the header on navigation.
