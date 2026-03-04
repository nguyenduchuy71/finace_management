# Requirements: FinanceManager

**Defined:** 2026-03-02
**Core Value:** Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: Dự án được khởi tạo với Vite + React 19 + TypeScript strict mode + Tailwind CSS + shadcn/ui
- [x] **FOUND-02**: Mock API được cài đặt bằng MSW 2.x, trả về dữ liệu giao dịch ngân hàng và thẻ tín dụng mẫu thực tế
- [x] **FOUND-03**: API service layer được định nghĩa với Zod schema validation cho tất cả response từ third-party API
- [ ] **FOUND-04**: TanStack Query v5 được cấu hình để quản lý server state (transactions, accounts, statements)
- [x] **FOUND-05**: Zustand store được cấu hình để quản lý UI state (filters, active tab, search query)

### Bank Transactions

- [ ] **BANK-01**: Người dùng có thể xem danh sách tất cả giao dịch của tài khoản ngân hàng (debit/credit)
- [ ] **BANK-02**: Mỗi giao dịch hiển thị: ngày, mô tả, số tiền (VND integer format), loại giao dịch
- [x] **BANK-03**: Người dùng có thể chọn xem theo từng tài khoản ngân hàng riêng biệt
- [ ] **BANK-04**: Danh sách giao dịch hỗ trợ pagination để xử lý số lượng lớn giao dịch

### Credit Card Transactions

- [ ] **CC-01**: Người dùng có thể xem danh sách giao dịch của từng thẻ tín dụng
- [ ] **CC-02**: Mỗi giao dịch thẻ hiển thị: ngày, merchant, số tiền, trạng thái (pending/posted)
- [x] **CC-03**: Người dùng có thể xem thông tin sao kê: ngày sao kê, ngày đến hạn, số dư hiện tại
- [x] **CC-04**: Ngày sao kê được tính toán chính xác theo timezone Việt Nam (UTC+7)

### Filter & Search

- [ ] **FILTER-01**: Người dùng có thể lọc giao dịch theo khoảng ngày (date range picker)
- [x] **FILTER-02**: Người dùng có thể lọc giao dịch theo tài khoản/thẻ
- [ ] **FILTER-03**: Người dùng có thể lọc theo loại giao dịch (income/expense)
- [ ] **FILTER-04**: Người dùng có thể tìm kiếm giao dịch theo tên/mô tả (text search)

### Dashboard

- [x] **DASH-01**: Người dùng có thể xem tổng thu và tổng chi trong kỳ được chọn
- [x] **DASH-02**: Người dùng có thể xem biểu đồ chi tiêu theo danh mục (category donut/bar chart bằng Recharts)
- [x] **DASH-03**: Tất cả trạng thái async được xử lý: loading skeleton, error state, empty state

### UX & Quality

- [x] **UX-01**: Website hiển thị đúng trên cả desktop lẫn mobile (responsive)
- [x] **UX-02**: Số tiền VND được format đúng: `đ 1.500.000` (không có decimal, dùng Intl.NumberFormat vi-VN)

## v2 Requirements

### Billing Cycle Grouping

- **CC-V2-01**: Giao dịch thẻ được nhóm theo chu kỳ sao kê thực (billing cycle grouping — differentiator chính)
- **CC-V2-02**: Người dùng có thể so sánh chi tiêu giữa các chu kỳ sao kê

### Export & Reporting

- **EXP-01**: Người dùng có thể xuất danh sách giao dịch ra CSV
- **EXP-02**: Người dùng có thể xuất sao kê ra PDF

### Real API Integration

- **API-01**: Kết nối với real third-party banking API (thay mock MSW)
- **API-02**: Serverless proxy (Vercel/Cloudflare Worker) để xử lý CORS và giấu API key

### Advanced Dashboard

- **DASH-V2-01**: Hiển thị số dư tổng hợp tất cả tài khoản
- **DASH-V2-02**: So sánh chi tiêu tháng này vs tháng trước

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user auth / login system | Dùng cá nhân, không cần auth phức tạp |
| Chuyển tiền / thanh toán | Read-only dashboard, không thực hiện giao dịch |
| Budget tracking / alerts | Nằm ngoài v1 scope, thêm sau nếu cần |
| Mobile app native (iOS/Android) | Web responsive đủ dùng |
| Real-time WebSocket updates | Không cần, refresh khi cần |
| Category editing / custom tags | v2 nếu có nhu cầu |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete (01-01) |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete (01-02) |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Complete |
| UX-02 | Phase 1 | Complete (01-02) |
| BANK-01 | Phase 2 | Pending |
| BANK-02 | Phase 2 | Pending |
| BANK-03 | Phase 2 | Complete |
| BANK-04 | Phase 2 | Pending |
| CC-01 | Phase 2 | Pending |
| CC-02 | Phase 2 | Pending |
| FILTER-01 | Phase 2 | Pending |
| FILTER-02 | Phase 2 | Complete |
| FILTER-03 | Phase 2 | Pending |
| FILTER-04 | Phase 2 | Pending |
| DASH-03 | Phase 2 | Complete |
| CC-03 | Phase 3 | Complete |
| CC-04 | Phase 3 | Complete |
| DASH-01 | Phase 4 | Complete |
| DASH-02 | Phase 4 | Complete |
| UX-01 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-03 after plan 01-02 completion*
