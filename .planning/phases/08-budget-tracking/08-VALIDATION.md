---
phase: 8
slug: budget-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library |
| **Config file** | vite.config.ts (vitest block) |
| **Quick run command** | `npm test -- src/stores/budgetStore.test.ts && npm test -- src/components/budget/BudgetProgressBar.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (store + progress bar tests)
- **After every plan wave:** Run full suite (`npm test`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | BUDGET-01 | unit | `npm test -- src/stores/budgetStore.test.ts -t "persist"` | ❌ W0 | ⬜ pending |
| 08-01-01 | 01 | 1 | BUDGET-01 | unit | `npm test -- src/stores/budgetStore.test.ts -t "getBudget"` | ❌ W0 | ⬜ pending |
| 08-01-01 | 01 | 1 | BUDGET-01 | unit | `npm test -- src/stores/budgetStore.test.ts -t "clearBudget"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | BUDGET-03 | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "render"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | BUDGET-03 | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "color"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | BUDGET-03 | unit | `npm test -- src/components/budget/BudgetProgressBar.test.ts -t "no budget"` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | BUDGET-01 | integration | `npm test -- src/components/budget/BudgetSettings.test.ts -t "save"` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | BUDGET-01 | integration | `npm test -- src/components/budget/BudgetSettings.test.ts -t "dialog"` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | BUDGET-02 | integration | `npm test -- src/features/dashboard/DashboardPage.test.ts -t "budget bars"` | ✅ Exists (needs budget bars added) | ⬜ pending |
| 08-02-checkpoint | 02 | 2 | BUDGET-01, BUDGET-02, BUDGET-03 | manual-verify | Manual browser verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/budgetStore.test.ts` — setBudget, clearBudget, localStorage round-trip, getBudget(unknown) returns 0 (unit tests)
- [ ] `src/components/budget/BudgetProgressBar.test.ts` — renders when budget > 0, hides when 0, color changes at 80%/100% thresholds (unit tests)
- [ ] `src/components/budget/BudgetSettings.test.ts` — open/close dialog, update budgets for all 6 categories, persist to store (integration tests)
- [ ] `src/features/dashboard/DashboardPage.test.ts` — update existing tests to verify budget progress bars appear when budgets exist
- [ ] Framework: Vitest v4 already installed in vite.config.ts; jest-dom in test-setup.ts — no installation needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings dialog accessible and fully functional | BUDGET-01 | Settings button UI deferrable; checkpoint manually verifies dialog launch and budget persistence | 1. Open app, navigate to Dashboard 2. Click settings button (if implemented) or use devtools 3. Enter budget values for all 6 categories in VND format (e.g., 5.000.000) 4. Click Save 5. Verify budgets persist in localStorage across page refresh |
| Progress bars appear with correct colors | BUDGET-02, BUDGET-03 | Color conditional logic verified by unit tests; integration test verifies dashboard layout; manual checkpoint confirms visual appearance | 1. Set budgets for 2-3 categories (500.000, 1.000.000, 2.000.000) 2. Verify progress bars appear below stat cards 3. Set spending to test color thresholds: 60% (emerald), 80% (yellow), 100% (red) 4. Verify colors match requirements |
| Data persists across sessions | BUDGET-01 | localStorage persistence logic unit tested; manual checkpoint confirms browser refresh | 1. Set budgets, refresh page 2. Verify budgets still exist in store 3. Verify progress bars re-appear with same data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 1: tasks 1-2 both have automated tests; Wave 2: tasks 1-2 have automated tests; checkpoint is manual-only, not consecutive)
- [ ] Wave 0 covers all MISSING references (all test files listed in Wave 0 Requirements section)
- [ ] No watch-mode flags (all commands use standard `npm test` format)
- [ ] Feedback latency < 45s (Vitest quick run ~30s, full suite ~40s)
- [ ] `nyquist_compliant: true` set in frontmatter when complete

**Approval:** pending
