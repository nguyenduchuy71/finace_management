# Requirements: FinanceManager

**Defined:** 2026-03-08
**Milestone:** v1.1 — Smart Insights & Polish
**Core Value:** Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.

## v1.1 Requirements

### Transaction Categories

- [ ] **CAT-01**: Each transaction displays a category badge auto-classified from merchant name using a fixed taxonomy (Ăn uống, Mua sắm, Di chuyển, Giải trí, Hóa đơn, Khác)
- [ ] **CAT-02**: User can override a transaction's auto-classified category; override persists in localStorage
- [ ] **CAT-03**: User can filter the transaction list by category (added to FilterBar)

### Budget Tracking

- [ ] **BUDGET-01**: User can set a monthly spending budget per category (stored in localStorage via Zustand budgetStore)
- [ ] **BUDGET-02**: Dashboard shows a spending progress bar per category (spent / budget, using existing categoryBreakdown data)
- [ ] **BUDGET-03**: Progress bar renders warning state (yellow ≥80%, red ≥100%) to alert when approaching or exceeding budget

### Month-over-Month Dashboard

- [ ] **DASH-V2-01**: Dashboard income/expense stat cards show a delta vs the previous calendar month (↑12% vs tháng trước)
- [ ] **DASH-V2-02**: Delta is hidden and replaced with "Chưa đủ dữ liệu" when current month has fewer than 5 transactions (avoids misleading early-month data)

### CSV Export

- [ ] **EXP-01**: A download button exports currently filtered transactions as a UTF-8 BOM CSV file (BOM ensures Vietnamese characters display correctly in Excel on Windows)
- [ ] **EXP-02**: CSV columns: Ngày, Mô tả, Số tiền (VND), Loại, Tài khoản, Danh mục; uses a dedicated service fetch (not the infinite-scroll cache)

### Chatbot UX Polish

- [ ] **CHAT-UX-01**: When the chat history is empty, 4 Vietnamese conversation starter chips are displayed (pre-fill only — clicking fills the input, does not auto-send)
- [ ] **CHAT-UX-02**: Each assistant message has a copy-to-clipboard button (verify if already implemented before building)
- [ ] **CHAT-UX-03**: Chat settings panel displays current model name clearly and has an intuitive, uncluttered layout

## Deferred (v1.2+)

### Real API Integration

- **API-01**: Connect to real third-party banking API (replace MSW mock)
- **API-02**: Serverless proxy (Vercel Function) for CORS and API key protection

### Notifications

- **NOTIF-01**: Alert when account balance is low or statement date is approaching

### Advanced Export

- **EXP-03**: Export transactions as PDF statement

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom category creation | Scope trap — fixed taxonomy is simpler and sufficient for personal use |
| Backend budget sync | Frontend-only; localStorage sufficient for personal single-user tool |
| Real-time balance updates | WebSocket complexity not justified; manual refresh is fine |
| Mobile native app | Web responsive is sufficient |
| Multi-user auth | Personal tool, single user |
| PDF export | CSV sufficient for v1.1; PDF deferred to v1.2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 7 | Pending |
| CAT-02 | Phase 7 | Pending |
| CAT-03 | Phase 7 | Pending |
| BUDGET-01 | Phase 8 | Pending |
| BUDGET-02 | Phase 8 | Pending |
| BUDGET-03 | Phase 8 | Pending |
| DASH-V2-01 | Phase 9 | Pending |
| DASH-V2-02 | Phase 9 | Pending |
| EXP-01 | Phase 10 | Pending |
| EXP-02 | Phase 10 | Pending |
| CHAT-UX-01 | Phase 11 | Pending |
| CHAT-UX-02 | Phase 11 | Pending |
| CHAT-UX-03 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after v1.1 milestone start*
