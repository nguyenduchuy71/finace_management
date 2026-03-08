---
phase: 9
slug: month-over-month-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library |
| **Config file** | vite.config.ts (vitest block) |
| **Quick run command** | `npm test -- src/utils/dates.test.ts src/hooks/useDashboardStats.test.ts --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (dates + dashboard stats tests)
- **After every plan wave:** Run full suite (`npm test -- --run`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DASH-V2-01 | unit | `npm test -- src/utils/dates.test.ts --run -t "calculateMonthDelta"` | ❌ W0 | ⬜ pending |
| 09-01-01 | 01 | 1 | DASH-V2-01 | unit | `npm test -- src/utils/dates.test.ts --run -t "getPreviousMonthDateRange"` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | DASH-V2-01 | integration | `npm test -- src/hooks/useDashboardStats.test.ts --run -t "parallel"` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | DASH-V2-01 | integration | `npm test -- src/hooks/useDashboardStats.test.ts --run -t "delta"` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | DASH-V2-01, DASH-V2-02 | unit | `npm test -- src/features/dashboard/StatCard.test.tsx --run -t "delta badge"` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | DASH-V2-02 | unit | `npm test -- src/features/dashboard/StatCard.test.tsx --run -t "insufficient data"` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | DASH-V2-02 | unit | `npm test -- src/features/dashboard/StatCard.test.tsx --run -t "hides delta"` | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 1 | DASH-V2-01, DASH-V2-02 | integration | `npm test -- src/pages/DashboardPage.test.tsx --run -t "month-over-month delta"` | ✅ Exists (needs month-over-month test added) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/dates.test.ts` — Add tests for `calculateMonthDelta()` (edge cases: zero baseline, negative delta) and `getPreviousMonthDateRange()` (year boundary, Feb→Jan)
- [ ] `src/hooks/useDashboardStats.test.ts` — Add tests for parallel query behavior; verify both current + previous month queries are made
- [ ] `src/features/dashboard/StatCard.test.tsx` — Add tests for delta badge rendering; verify "Chưa đủ dữ liệu" shows when transactionCount < 5
- [ ] `src/pages/DashboardPage.test.tsx` — Add integration test for month-over-month delta display end-to-end
- [ ] Framework: Vitest v4 already installed in vite.config.ts; jest-dom in test-setup.ts — no installation needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Month boundary transitions work correctly | DASH-V2-01 | Complex timezone-dependent behavior; unit tests cover logic, manual verification confirms real-world behavior | 1. Navigate to Dashboard 2. Set date range to last 2 days of month and first 2 days of next month 3. Verify delta correctly compares current vs previous month (not mixed data) |
| Delta badge displays with correct direction | DASH-V2-01 | Visual presentation of ↑ vs ↓ is user-visible; automated tests verify logic, manual confirms visual clarity | 1. Run app with fixture data 2. Verify income delta shows ↑ if income increased 3. Verify expense delta shows ↓ if spending decreased 4. Confirm Vietnamese text "vs tháng trước" is readable |
| Insufficient data message clarity | DASH-V2-02 | User message understandability; automated test checks threshold logic, manual confirms message is clear | 1. Filter to month with <5 transactions 2. Verify "Chưa đủ dữ liệu" appears instead of delta 3. Confirm stat card still shows total amount (just no delta) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 1: 4 tasks all have automated tests)
- [ ] Wave 0 covers all MISSING references (all test files listed in Wave 0 Requirements section)
- [ ] No watch-mode flags (all commands use `--run` flag for CI-style execution)
- [ ] Feedback latency < 60s (Vitest quick run ~45s, full suite ~55s)
- [ ] `nyquist_compliant: true` set in frontmatter when complete

**Approval:** pending
