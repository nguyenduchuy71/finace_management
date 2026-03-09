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
- [x] **BUDGET-03**: Progress bar renders warning state (yellow ≥80%, red ≥100%) to alert when approaching or exceeding budget

### Month-over-Month Dashboard

- [ ] **DASH-V2-01**: Dashboard income/expense stat cards show a delta vs the previous calendar month (↑12% vs tháng trước)
- [ ] **DASH-V2-02**: Delta is hidden and replaced with "Chưa đủ dữ liệu" when current month has fewer than 5 transactions (avoids misleading early-month data)

### CSV Export

- [x] **EXP-01**: A download button exports currently filtered transactions as a UTF-8 BOM CSV file (BOM ensures Vietnamese characters display correctly in Excel on Windows)
- [x] **EXP-02**: CSV columns: Ngày, Mô tả, Số tiền (VND), Loại, Tài khoản, Danh mục; uses a dedicated service fetch (not the infinite-scroll cache)

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

## Traceability to Roadmap

| Requirement | Phase | Phase Name | Status |
|-------------|-------|-----------|--------|
| CAT-01, CAT-02 | 7 | Transaction Categories | In Progress (07-01 foundation) |
| CAT-03 | 7 | Transaction Categories | Pending (07-02 and 07-03) |
| BUDGET-01, BUDGET-02, BUDGET-03 | 8 | Budget Tracking | Pending |
| DASH-V2-01, DASH-V2-02 | 9 | Month-over-Month Dashboard | Pending |
| EXP-01, EXP-02 | 10 | CSV Export | Complete |
| CHAT-UX-01, CHAT-UX-02, CHAT-UX-03 | 11 | Chatbot UX Polish | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13 (Phases 7–11)
- Unmapped: 0 ✓
- Phase dependencies: 7 → 8, 7 → 10; all others independent

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after v1.1 milestone start*
