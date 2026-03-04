---
phase: "06"
plan: "04"
subsystem: deployment
tags: [vercel, deployment, msw, environment-variables, production]
dependency_graph:
  requires: ["06-01", "06-02", "06-03"]
  provides: ["production-deployment-config", "msw-prod-guard"]
  affects: ["src/main.tsx"]
tech_stack:
  added: []
  patterns: ["VITE_ENABLE_MSW env gate for MSW production guard"]
key_files:
  created:
    - vercel.json
    - .env.example
    - .vercelignore
  modified:
    - src/main.tsx
    - src/features/chatbot/ChatPanel.test.tsx
    - src/features/transactions/TransactionList.test.tsx
    - src/hooks/useTransactions.test.ts
decisions:
  - "VITE_ENABLE_MSW=false set in vercel.json env block — explicit opt-out of MSW at Vercel build time"
  - "main.tsx guards MSW with both import.meta.env.DEV AND VITE_ENABLE_MSW !== 'false' — dual guard"
  - "npm ci used in installCommand for reproducible installs over npm install"
  - "sfo1 region selected for Vercel deployment — US West, low latency for primary users"
metrics:
  duration: "2 min"
  completed: "2026-03-04"
  tasks: 3
  files: 7
---

# Phase 6 Plan 04: Vercel Deployment Setup Summary

**One-liner:** Vercel deployment configuration with vercel.json, .env.example, .vercelignore, and MSW production guard via VITE_ENABLE_MSW env variable.

## What Was Built

Deployment infrastructure for the Vibe Finance Management app to Vercel:

1. **vercel.json** — Vercel-specific deployment configuration with build command (`tsc -b && vite build`), output directory (`dist`), install command (`npm ci`), production env vars (`VITE_ENABLE_MSW=false`), and git deployment settings for main + preview branches.

2. **.env.example** — Developer documentation for required environment variables (`VITE_API_ENDPOINT`, `VITE_ENABLE_MSW`) with instructions for local vs production setup.

3. **.vercelignore** — Excludes node_modules, .git, .planning, dist, test files, and IDE config from the Vercel deployment bundle to reduce size and deployment time.

4. **MSW production guard** — Updated `src/main.tsx` to check both `import.meta.env.DEV` AND `import.meta.env.VITE_ENABLE_MSW !== 'false'`. When Vercel sets `VITE_ENABLE_MSW=false` in vercel.json, MSW is skipped at initialization — the app will call real APIs instead of mock handlers.

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Create vercel.json | Done | 0319aa5 |
| Task 2: Create .env.example and .vercelignore | Done | b0198da |
| Task 3: MSW production guard via VITE_ENABLE_MSW | Done | ba2c59b |
| Task 4: Deploy to Vercel | Awaiting human (checkpoint) | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused imports in 3 test files blocking TypeScript build**

- **Found during:** Task 3 (first build attempt)
- **Issue:** `tsc -b` failed with TS6133 (unused variable) errors on 3 test files — `waitFor` unused in `ChatPanel.test.tsx`, `vi` unused in `TransactionList.test.tsx` and `useTransactions.test.ts`
- **Fix:** Removed the unused imports from each file's import statement
- **Files modified:** `src/features/chatbot/ChatPanel.test.tsx`, `src/features/transactions/TransactionList.test.tsx`, `src/hooks/useTransactions.test.ts`
- **Commit:** ba2c59b (included in Task 3 commit)

## Build Verification

Production build (`npm run build`) output after Task 3:

```
dist/index.html                  0.61 kB  │ gzip: 0.34 kB
dist/assets/recharts-*.js      372.45 kB  │ gzip: 110.61 kB
dist/assets/index-*.js         525.50 kB  │ gzip: 167.95 kB
Built in 9.53s — ZERO errors, ZERO warnings
```

Main bundle 525KB (accepted per Phase 06-01 decision: React/TanStack/shadcn shared deps cannot be split further).

## MSW Flow in Production

- **Development (no env):** `VITE_ENABLE_MSW` unset → `!== 'false'` is `true` + `DEV` is `true` → MSW enabled
- **Production (Vercel):** `VITE_ENABLE_MSW=false` set in vercel.json → `!== 'false'` is `false` → MSW skipped immediately
- **CI override:** Set `VITE_ENABLE_MSW=false` in any environment to disable MSW without changing code

## Pending Checkpoint

Task 4 (Vercel deployment) and the final checkpoint require human action:

1. Push repository to GitHub
2. Import to Vercel at https://vercel.com/new
3. Select Vite framework, confirm build settings from vercel.json
4. Deploy and verify production URL
5. Run Lighthouse audit on production URL (target: mobile ≥90, desktop ≥95)

## Self-Check: PASSED

- vercel.json: EXISTS at D:\Vibe Coding\finace_management\vercel.json
- .env.example: EXISTS at D:\Vibe Coding\finace_management\.env.example
- .vercelignore: EXISTS at D:\Vibe Coding\finace_management\.vercelignore
- src/main.tsx: UPDATED with VITE_ENABLE_MSW check
- Commit 0319aa5: FOUND (vercel.json)
- Commit b0198da: FOUND (.env.example + .vercelignore)
- Commit ba2c59b: FOUND (MSW guard + test fixes)
- Build: PASSED (zero errors, zero warnings)
