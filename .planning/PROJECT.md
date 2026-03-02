# FinanceManager — Quản Lý Tài Chính Cá Nhân

## What This Is

Website quản lý tài chính cá nhân, frontend-only, hiển thị các giao dịch của tài khoản ngân hàng và thẻ tín dụng. Data được lấy về từ API bên thứ 3 và hiển thị trực quan theo ngày, loại giao dịch, và ngày sao kê thẻ tín dụng. Hướng tới người dùng cá nhân muốn có cái nhìn tổng quan về tài chính của mình.

## Core Value

Người dùng có thể xem toàn bộ giao dịch ngân hàng và thẻ tín dụng ở một nơi duy nhất, được tổ chức rõ ràng theo chu kỳ sao kê.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Người dùng có thể xem danh sách giao dịch ngân hàng (debit)
- [ ] Người dùng có thể xem danh sách giao dịch thẻ tín dụng (credit card)
- [ ] Người dùng có thể xem ngày sao kê và chu kỳ sao kê thẻ tín dụng
- [ ] Người dùng có thể xem dashboard tổng quan (số dư, tổng thu, tổng chi)
- [ ] Người dùng có thể lọc giao dịch theo ngày, loại, tài khoản
- [ ] Người dùng có thể tìm kiếm giao dịch theo tên/mô tả
- [ ] Data được gọi realtime từ API bên thứ 3 (mock API cho dev)

### Out of Scope

- Backend / server-side logic — frontend only, gọi API bên thứ 3
- Multi-user authentication — dùng cá nhân, không cần complex auth
- Thanh toán / chuyển tiền — chỉ đọc (read-only), không thực hiện giao dịch
- Mobile app native — web responsive, không build app riêng

## Context

- **Stack**: Frontend only (React + TypeScript), không có backend riêng
- **API Integration**: Gọi API bên thứ 3 để lấy dữ liệu giao dịch; dùng mock API trong development để dễ test
- **Data model**: Tài khoản ngân hàng (bank account) + thẻ tín dụng (credit card), mỗi loại có giao dịch và thông tin sao kê
- **Scope**: Personal finance dashboard — read-only, hiển thị và tổ chức data

## Constraints

- **Tech Stack**: Frontend only — React, TypeScript, không có backend riêng
- **API**: Gọi external API bên thứ 3, cần xử lý CORS, loading state, error state
- **Performance**: Cần xử lý pagination nếu số lượng giao dịch lớn
- **Responsive**: Phải xem được trên cả desktop lẫn mobile

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Frontend-only | Đơn giản hóa stack, không cần backend | — Pending |
| Mock API trước | Cho phép build UI mà không cần API thật ngay | — Pending |
| React + TypeScript | Standard stack, type-safe, ecosystem lớn | — Pending |

---
*Last updated: 2026-03-02 after initialization*
