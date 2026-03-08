---
phase: 10
slug: csv-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library |
| **Config file** | vite.config.ts (test section) |
| **Quick run command** | `npm test -- src/utils/csv.test.ts src/services/exports.test.ts --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~70 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (CSV utils + export service tests)
- **After every plan wave:** Run full suite (`npm test -- --run`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 70 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | EXP-01 | unit | `npm test -- src/utils/csv.test.ts --run -t "BOM"` | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | EXP-01 | unit | `npm test -- src/utils/csv.test.ts --run -t "charset"` | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | EXP-02 | unit | `npm test -- src/utils/csv.test.ts --run -t "headers"` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | EXP-02 | integration | `npm test -- src/services/exports.test.ts --run -t "filters"` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | EXP-02 | integration | `npm test -- src/services/exports.test.ts --run -t "full result"` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | EXP-01, EXP-02 | component | `npm test -- src/components/filters/ExportButton.test.tsx --run -t "export"` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | EXP-01, EXP-02 | integration | `npm test -- src/components/filters/FilterBar.test.tsx --run -t "ExportButton"` | ✅ Exists (add export button test) | ⬜ pending |
| 10-02-03 | 02 | 2 | EXP-01, EXP-02 | manual-verify | Manual browser verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/csv.test.ts` — Unit tests for formatTransactionForCSV(), downloadCSV(), BOM injection, charset encoding
- [ ] `src/services/exports.test.ts` — Integration tests for exportTransactions() with all filter combinations (date range, account, type, category)
- [ ] `src/components/filters/ExportButton.test.tsx` — Component tests for button disabled state, export handler, error toast feedback
- [ ] Framework: Vitest v4 already installed; jest-dom in test-setup.ts — no installation needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV downloads with correct filename | EXP-02 | Filename format is user-visible; automated test can mock but manual confirms UX | 1. Click export button 2. Check browser download filename is transactions-YYYY-MM-DD.csv 3. Confirm date matches current date |
| Vietnamese characters display correctly in Excel | EXP-01 | Character encoding is environment-dependent (Windows vs Mac Excel); manual test verifies no mojibake | 1. Download CSV 2. Open in Excel (Windows) 3. Verify Vietnamese headers and transaction descriptions display without garbled characters 4. Verify currency amounts show correctly with đ symbol |
| Filters are respected in CSV output | EXP-02 | Integration test verifies data, but manual test confirms UI-to-export flow works correctly | 1. Set filters in UI (e.g., specific date range, category) 2. Click export 3. Open CSV and verify row count and data match filtered list shown in UI 4. Verify all rows are from selected category/date range |
| Toast notification feedback | EXP-01 | Toast appearance and dismiss behavior is visual; automation can check existence but manual confirms UX quality | 1. Click export button 2. Verify success toast appears briefly 3. Test error case (e.g., network issue) and verify error toast appears 4. Confirm button re-enables after export completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 1: tasks 1-2 have automated tests; Wave 2: tasks 1-2 have automated tests; task 3 is manual checkpoint)
- [ ] Wave 0 covers all MISSING references (all test files listed in Wave 0 Requirements section)
- [ ] No watch-mode flags (all commands use `--run` flag for CI-style execution)
- [ ] Feedback latency < 70s (Vitest quick run ~60s, full suite ~65s)
- [ ] `nyquist_compliant: true` set in frontmatter when complete

**Approval:** pending
