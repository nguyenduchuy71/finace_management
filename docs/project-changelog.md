# Changelog

## 2026-10-19 — Hoàn tiền: bậc thang theo mức chi và trần tổng cho cả thẻ

Chi tiết: [credit-card-cashback.md](credit-card-cashback.md).

### Thêm
- **Bậc thang** cho mỗi rule hoàn tiền (tối đa 5 bậc thêm): chi đạt bậc nào thì % của bậc đó áp cho cả
  khoản chi (không lũy tiến). `rate_percent` + `min_cycle_spend` hiện có là bậc nền nên rule cũ giữ nguyên.
- **Trần hoàn tiền cả thẻ** (`credit_cards.cashback_monthly_cap`), cắt sau trần của từng rule.
- RPC `save_cashback_rule`: lưu rule và toàn bộ bậc trong một transaction (không còn rule nửa vời).
- UI: danh sách bậc trong form rule, ô trần cả thẻ trong hộp thoại rule, khối "Hoàn tiền ước tính kỳ này"
  hiện % của bậc đang áp, "Còn X nữa để lên bậc Y%" và huy hiệu "Đã chạm trần thẻ".
- `supabase/tests/card-cashback-tiers-rls.sql`: ca chéo 2 user cho bảng bậc, RPC và trần thẻ.

### Thay đổi hành vi / cần biết khi deploy
- Migration `20261019100000` cần áp **cùng** migration `20261018140000` nếu cả hai chưa lên production.
- Ghi rule hoàn tiền từ client giờ đi qua RPC (`createCashbackRule` / `updateCashbackRule(cardId, ruleId, …)`);
  RPC thay thế **toàn bộ** bậc, nên mọi lời gọi phải gửi đủ danh sách bậc.
- `CashbackRule` có thêm `tiers`, `CreditCard` có thêm `cashbackMonthlyCap`, `computeCashback` nhận thêm
  `cardCap`; kết quả có thêm `uncappedTotal`, `cardCapped`, và mỗi rule có `appliedRatePercent`, `tierIndex`, `nextTier`.
- Vách đá là hành vi đúng: nền `≥5tr → 0,5%`, bậc `≥10tr → 1%` thì chi 9.999.999đ hoàn 49.999đ, chi 10.000.000đ hoàn 100.000đ.

## 2026-10-19 — Quản lý thẻ, MCC và hoàn tiền ước tính

Chi tiết tính năng: [credit-card-cashback.md](credit-card-cashback.md).

### Thêm
- Thêm / sửa / xoá thẻ tín dụng; xoá kèm toàn bộ giao dịch qua RPC `delete_credit_card`.
- Gán MCC cho giao dịch thẻ (16 nhóm), gợi ý theo tên merchant (không tự lưu); cột MCC trong CSV của thẻ.
- Rule hoàn tiền theo thẻ (% theo nhóm MCC, chi tối thiểu, trần hoàn mỗi kỳ) và khối "Hoàn tiền ước
  tính kỳ này" trong thẻ chu kỳ sao kê.
- `supabase/tests/card-crud-rls.sql`: bộ kiểm tra RLS / ràng buộc / RPC gồm các ca chéo 2 user.

### Sửa (bảo mật) — **migration `20261018140000` siết RLS, cần đọc trước khi deploy**
- `transactions`: policy insert/update giờ kiểm `card_id` / `account_id` thuộc chính user. Trước đây
  user A chèn được giao dịch trỏ vào thẻ của user B; khi B xoá thẻ, giao dịch của A bị `set null` thành
  giao dịch mồ côi (ẩn khỏi danh sách nhưng dashboard vẫn đếm).
- Cần Postgres 15+ (`unique nulls not distinct`). Production hiện là 17.6.

### Sửa
- `computeCurrentCycle`: kẹp ngày sao kê 29–31 vào độ dài tháng. Thẻ sao kê ngày 31 trước đây hiển thị
  sai chu kỳ trong tháng 4 và ngày 1/5 trả về chu kỳ bắt đầu sau thời điểm hiện tại.
- `BillingCycleInfoCard` tự cập nhật theo thời gian thay vì chốt lúc mount.
- `exportTransactions` báo lỗi khi vượt 100 trang (50.000 dòng) thay vì trả mảng bị cắt cụt im lặng.

### Dọn lint (ESLint từ 21 lỗi về 0)
- `ChatInput`: điền sẵn từ gợi ý hội thoại dùng mẫu "điều chỉnh state trong lúc render" thay cho `setState` trong effect; thêm test cố định hành vi (trước đây chưa có test nào cho prefill).
- `CreditCardTransactionList`: sửa dependency của `useMemo` và dùng `useNow()` như `BillingCycleInfoCard`, để hai khối cùng trang luôn hiện cùng một chu kỳ; thêm test.
- `queryClient` chuyển sang `src/lib/query-client.ts`; `getPreviousMonthDateRange` bỏ tham số `dateTo` không dùng.
- Test: thay `as any` bằng fixture có kiểu; bỏ trường `meta` cũ trong mock `exportTransactions`.

### Thay đổi hành vi cần biết
- `TX_COLUMNS` có thêm `mcc` (dùng chung cho danh sách tài khoản, danh sách thẻ và export).
- Form thẻ bắt buộc `card_number` dạng `****xxxx` và chuẩn hoá hoa/thường tên ngân hàng đã biết.
- Ô nhập tiền chỉ nhận số thuần hoặc nhóm nghìn **cùng một kiểu dấu**; `1.5`, `1,5`, `1,000.000`
  bị từ chối thay vì đoán (từng bị đọc thành 15đ và 1.000.000đ).
