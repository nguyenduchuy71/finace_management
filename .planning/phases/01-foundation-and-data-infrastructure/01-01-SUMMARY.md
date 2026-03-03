---
phase: 01-foundation-and-data-infrastructure
plan: "01"
subsystem: infra
tags: [vite, react, typescript, tailwind, shadcn, msw, tanstack-query, zustand, zod, react-router]

# Dependency graph
requires: []
provides:
  - Vite 7 + React 19 + TypeScript strict mode project scaffold
  - Tailwind CSS v4 with shadcn/ui (New York style, tw-animate-css)
  - All Phase 1 runtime dependencies installed and resolved
  - MSW service worker at public/mockServiceWorker.js
  - Deferred render guard in main.tsx (enableMocking pattern)
  - QueryClientProvider + BrowserRouter shell in App.tsx
  - Feature directory structure (accounts, transactions, creditCards, dashboard)
  - Shared directory structure (hooks, services, stores, types, utils, mocks/fixtures)
affects:
  - 01-02 (MSW mock data layer — uses mocks/browser.ts + handlers.ts scaffold)
  - 01-03 (API service layer — uses services/, types/ directories and QueryClient config)
  - all subsequent phases (all build on this project structure)

# Tech tracking
tech-stack:
  added:
    - vite@7.3.1
    - react@19.2.4
    - react-dom@19.2.4
    - typescript@5.9.3
    - tailwindcss@4.0.0 (via @tailwindcss/vite@4.2.1)
    - tw-animate-css@1.4.0
    - shadcn@3.8.5 (New York style, default base color)
    - "@tanstack/react-query@5.90.21"
    - "@tanstack/react-query-devtools@5.91.3"
    - zustand@5.0.11
    - axios@1.13.6
    - date-fns@4.1.0
    - "@date-fns/tz@1.4.1"
    - zod@4.3.6
    - clsx@2.1.1
    - tailwind-merge@3.5.0
    - react-router-dom@7.13.1
    - msw@2.12.10
    - vitest@4.0.18
    - "@testing-library/react@16.3.2"
    - "@testing-library/user-event@14.6.1"
    - jsdom@28.1.0
    - sonner@2.0.7
  patterns:
    - MSW deferred render guard in main.tsx (await worker.start() before ReactDOM.createRoot)
    - QueryClient config locked with staleTime=5min, gcTime=10min, retry=2, refetchOnWindowFocus=false
    - "@/ path alias pointing to src/"
    - Feature-based directory structure under src/features/
    - shadcn components under src/components/ui/

key-files:
  created:
    - src/main.tsx
    - src/App.tsx
    - src/mocks/browser.ts
    - src/mocks/handlers.ts
    - src/components/ui/sonner.tsx
    - src/lib/utils.ts
    - src/index.css
    - public/mockServiceWorker.js
    - components.json
  modified:
    - vite.config.ts
    - tsconfig.app.json
    - tsconfig.json
    - package.json

key-decisions:
  - "shadcn/ui defaults used (New York style, default color scheme) instead of explicit Slate base color — shadcn@3.8.5 --defaults flag selects defaults automatically"
  - "Tailwind CSS v4 uses @import 'tailwindcss' in index.css instead of tailwind.config.js — CSS-first configuration"
  - "tw-animate-css installed by shadcn (not tailwindcss-animate) — shadcn v4 uses tw-animate-css"
  - "QueryClient staleTime=5min, gcTime=10min, retry=2 — locked as project-wide defaults per CONTEXT.md"
  - "import.meta.env.DEV used in enableMocking() guard (not process.env.NODE_ENV) — Vite-specific pattern"

patterns-established:
  - "MSW deferred render pattern: enableMocking().then(() => ReactDOM.createRoot(...)) ensures worker starts before first render"
  - "@/ alias resolves to src/ — consistent across vite.config.ts, tsconfig.app.json, tsconfig.json"
  - "Named export for App component (export function App) not default export"
  - "QueryClient defined at module scope (outside component) to prevent recreation on re-renders"

requirements-completed: [FOUND-01]

# Metrics
duration: 35min
completed: 2026-03-03
---

# Phase 1 Plan 01: Project Foundation Scaffold Summary

**Vite 7 + React 19 + TypeScript strict mode scaffolded with Tailwind CSS v4, shadcn/ui, TanStack Query 5, MSW 2 deferred render guard, and complete feature directory structure**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-03T00:02:18Z
- **Completed:** 2026-03-03T00:37:00Z
- **Tasks:** 2 of 2
- **Files modified:** 20+

## Accomplishments

- Greenfield Vite project scaffolded with all Phase 1 runtime and dev dependencies installed
- MSW deferred render guard wired in main.tsx — prevents TanStack Query firing before MSW service worker registers
- App.tsx shell with QueryClientProvider (locked config: 5min staleTime, 10min gcTime, retry=2) + BrowserRouter + Sonner Toaster
- Complete feature directory scaffold (accounts, transactions, creditCards, dashboard) + shared dirs (hooks, services, stores, types, utils, mocks/fixtures)
- Build verified: zero TypeScript errors, zero warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vite project and install all dependencies** - `3a7a63e` (feat)
2. **Task 2: Create directory scaffold and wire App shell** - `48acf11` (feat)

## Files Created/Modified

- `src/main.tsx` - MSW deferred render guard with enableMocking() + ReactDOM.createRoot
- `src/App.tsx` - QueryClientProvider + BrowserRouter + Toaster shell with locked QueryClient config
- `src/mocks/browser.ts` - MSW setupWorker pointing to handlers
- `src/mocks/handlers.ts` - Empty handlers array (filled in Plan 03)
- `src/components/ui/sonner.tsx` - shadcn Sonner toast component
- `src/lib/utils.ts` - shadcn cn() utility (clsx + tailwind-merge)
- `src/index.css` - Tailwind v4 CSS-first config with shadcn design tokens
- `public/mockServiceWorker.js` - MSW browser service worker (9.1 KB)
- `components.json` - shadcn/ui configuration
- `vite.config.ts` - Added @tailwindcss/vite plugin + @/ path alias
- `tsconfig.app.json` - Added baseUrl and paths for @/ alias (strict: true already present)
- `tsconfig.json` - Added compilerOptions with @/ paths for shadcn validator
- `package.json` - All runtime + dev dependencies declared

## Decisions Made

- **shadcn defaults**: Used `--defaults` flag; shadcn@3.8.5 chose default color scheme (not Slate as written in plan prompt — functionally equivalent, colors are CSS variables)
- **tw-animate-css**: shadcn v4 installs `tw-animate-css` (not `tailwindcss-animate`) — this is the correct package for Tailwind v4
- **Tailwind v4 CSS-first config**: No `tailwind.config.js` file — Tailwind v4 uses `@import "tailwindcss"` in CSS with `@theme inline` blocks
- **tsconfig.json patch**: Added `compilerOptions.paths` to root tsconfig.json to satisfy shadcn's alias validator (shadcn reads root tsconfig, not tsconfig.app.json)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite scaffold refused to run in non-empty directory**
- **Found during:** Task 1 (npm create vite)
- **Issue:** `npm create vite@latest . -- --template react-ts` cancelled immediately because .git/.planning directories existed
- **Fix:** Scaffolded into temp subdirectory `_vite_temp`, then `cp -r` to project root, removed temp dir
- **Files modified:** All scaffolded files copied to root
- **Verification:** Build passed after copy
- **Committed in:** 3a7a63e (Task 1 commit)

**2. [Rule 3 - Blocking] shadcn init failed: no Tailwind CSS config found**
- **Found during:** Task 1 (npx shadcn@latest init)
- **Issue:** shadcn validator checks for Tailwind CSS before accepting init — Tailwind not yet installed
- **Fix:** Installed `tailwindcss@next @tailwindcss/vite`, added `@import "tailwindcss"` to index.css, updated vite.config.ts with `@tailwindcss/vite` plugin, ran shadcn init again
- **Files modified:** src/index.css, vite.config.ts, package.json
- **Verification:** shadcn init completed successfully
- **Committed in:** 3a7a63e (Task 1 commit)

**3. [Rule 3 - Blocking] shadcn init failed: no import alias in tsconfig.json**
- **Found during:** Task 1 (after fixing Tailwind)
- **Issue:** shadcn reads root tsconfig.json for `paths` — root tsconfig.json only had `references`, no `compilerOptions`
- **Fix:** Added `compilerOptions.baseUrl` and `compilerOptions.paths` to root tsconfig.json alongside the existing `references` structure
- **Files modified:** tsconfig.json
- **Verification:** shadcn init completed successfully on second attempt
- **Committed in:** 3a7a63e (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues)
**Impact on plan:** All auto-fixes were infrastructure/tooling prerequisites. No scope creep. Plan objectives fully achieved.

## Issues Encountered

- Vite scaffold into non-empty directory required workaround (temp directory approach)
- shadcn init requires both Tailwind CSS AND path alias to be configured before it will run — order matters
- Root tsconfig.json needs `compilerOptions.paths` even in a project references setup for shadcn's validator

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 Plan 02 (MSW mock data layer) can proceed immediately — `src/mocks/handlers.ts` scaffold ready
- Phase 1 Plan 03 (API service layer + Zod types) can proceed — `src/services/` and `src/types/` directories ready
- QueryClient config is locked and should not be changed by subsequent plans
- MSW service worker is registered in `public/` — `package.json` msw.workerDirectory is set

---
*Phase: 01-foundation-and-data-infrastructure*
*Completed: 2026-03-03*

## Self-Check: PASSED

- src/main.tsx: FOUND
- src/App.tsx: FOUND
- src/mocks/browser.ts: FOUND
- src/mocks/handlers.ts: FOUND
- src/components/ui/sonner.tsx: FOUND
- public/mockServiceWorker.js: FOUND
- .planning/phases/01-foundation-and-data-infrastructure/01-01-SUMMARY.md: FOUND
- All feature directories (accounts, transactions, creditCards, dashboard): FOUND
- All shared directories (hooks, services, stores, types, utils, mocks/fixtures): FOUND
- Commit 3a7a63e (Task 1): FOUND
- Commit 48acf11 (Task 2): FOUND
