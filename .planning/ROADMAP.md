# Roadmap: FinanceManager

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-03-04) → [archive](.planning/milestones/v1.0-ROADMAP.md)
- 📋 **v1.1** — Phases 7+ (planned)

## Phases

**Phase Numbering:**
- Integer phases (7, 8, ...): v1.1 milestone work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 MVP (Phases 1–6) — SHIPPED 2026-03-04</summary>

- [x] Phase 1: Foundation and Data Infrastructure (3/3 plans) — completed 2026-03-03
- [x] Phase 2: Core Transaction Views (5/5 plans) — completed 2026-03-04
- [x] Phase 3: Credit Card Billing Cycle (2/2 plans) — completed 2026-03-04
- [x] Phase 4: Dashboard and Polish (2/2 plans) — completed 2026-03-04
- [x] Phase 5: Chatbot Integration (3/3 plans) — completed 2026-03-04
- [x] Phase 6: Optimize & Deploy (4/4 plans) — completed 2026-03-04

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

## Phase 7: Transaction Categories
**Goal**: Each transaction shows a category badge auto-classified from merchant name. Users can override and filter by category.
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: CAT-01, CAT-02, CAT-03
**Success Criteria**:
  1. Transaction rows display category badge (Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Khác)
  2. User can click category badge to override (modal or inline edit) — override persists in localStorage
  3. FilterBar has new category filter control; filtering by category narrows the list
  4. All existing tests pass; no regression in transaction list rendering
**Plans**: 3 plans
- [x] 07-01-PLAN.md — Foundation: utilities, store, badge component (completed 2026-03-08)
- [x] 07-02-PLAN.md — UI Integration: FilterBar, TransactionRow, service wiring (completed 2026-03-08)
- [x] 07-03-PLAN.md — MSW handlers and integration tests (completed 2026-03-08)

## Phase 8: Budget Tracking
**Goal**: Users set monthly budgets per category and see progress on dashboard.
**Depends on**: Phase 7 (categories must exist first)
**Requirements**: BUDGET-01, BUDGET-02, BUDGET-03
**Success Criteria**:
  1. Settings page (new or existing) has budget input per category (currency format: đ X.XXX)
  2. Dashboard shows budget progress bars per category (spent / budget) below stat cards
  3. Progress bar color changes: yellow ≥80%, red ≥100%
  4. Budgets persist in localStorage; no backend required
**Plans**: 3 plans
- [x] 08-01-PLAN.md — Budget store and progress bar component (completed 2026-03-08)
- [x] 08-02-PLAN.md — Settings UI and dashboard integration (completed 2026-03-08)
- [ ] 08-03-PLAN.md — Budget alerts and notifications (Wave 3)

## Phase 9: Month-over-Month Dashboard
**Goal**: Dashboard stat cards show spending delta vs previous month to highlight trends.
**Depends on**: Phase 6 (dashboard exists)
**Requirements**: DASH-V2-01, DASH-V2-02
**Success Criteria**:
  1. Income and expense stat cards show delta badge (e.g., ↑12% vs tháng trước)
  2. Delta hidden and replaced with "Chưa đủ dữ liệu" when current month < 5 transactions
  3. Month boundaries use Vietnam UTC+7 timezone (not browser timezone)
  4. No extra API calls; delta calculated from existing dashboard data
**Plans**: 1–2 plans

## Phase 10: CSV Export
**Goal**: Filtered transactions can be exported to CSV for spreadsheets and tax prep.
**Depends on**: Phase 7 (categories needed for CSV column)
**Requirements**: EXP-01, EXP-02
**Success Criteria**:
  1. Export button downloads CSV with UTF-8 BOM header (Vietnamese Excel compatibility)
  2. CSV includes columns: Ngày, Mô tả, Số tiền, Loại, Tài khoản, Danh mục
  3. Export respects active filters (date range, account, type, category)
  4. No attempt to read from infinite-scroll cache; dedicated service fetch
**Plans**: 1–2 plans

## Phase 11: Chatbot UX Polish
**Goal**: Improve chat UI with conversation starters, cleaner design, and verified copy button.
**Depends on**: Phase 5 (chatbot exists from v1.0)
**Requirements**: CHAT-UX-01, CHAT-UX-02, CHAT-UX-03
**Success Criteria**:
  1. Empty chat state shows 4 Vietnamese conversation starters (pre-fill input, no auto-send)
  2. Each assistant message has copy-to-clipboard button (audit existing code first)
  3. Chat settings panel displays current model name clearly; layout is clean
  4. Chat UI passes mobile responsive audit; no horizontal overflow
**Plans**: 1–2 plans

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-03 |
| 2. Core Transaction Views | v1.0 | 5/5 | Complete | 2026-03-04 |
| 3. Credit Card Billing Cycle | v1.0 | 2/2 | Complete | 2026-03-04 |
| 4. Dashboard and Polish | v1.0 | 2/2 | Complete | 2026-03-04 |
| 5. Chatbot Integration | v1.0 | 3/3 | Complete | 2026-03-04 |
| 6. Optimize & Deploy | v1.0 | 4/4 | Complete | 2026-03-04 |
| 7. Transaction Categories | v1.1 | 3/3 | Complete | 2026-03-08 |
| 8. Budget Tracking | v1.1 | 0/2 | Pending | — |
| 9. Month-over-Month Dashboard | v1.1 | 0/? | Pending | — |
| 10. CSV Export | v1.1 | 0/? | Pending | — |
| 11. Chatbot UX Polish | v1.1 | 0/? | Pending | — |
