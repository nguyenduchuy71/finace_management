# Changelog

## 2026-10-27 — Đăng ký tài khoản, API key theo user, xoá tài khoản (SaaS phase 1/4)

Plan: `plans/261027-1012-saas-signup-api-key-credits/` (phase 1). PR #18.

### Thêm
- **Đăng ký** (`/signup`): email + mật khẩu ≥ 8 ký tự, ô đồng ý xử lý dữ liệu; phiên bản chính sách ghi vào `user_settings`.
- **Trang Cài đặt** (`/settings`): tạo/thu hồi **API key** cho iOS Shortcut (key hiện một lần, tối đa 10 key còn hiệu lực),
  **tên chủ tài khoản** để nhận diện chuyển nội bộ (thay secret `OWNER_NAMES`), **xoá tài khoản** cùng toàn bộ dữ liệu.
- Edge function `delete-account`. Rate limit 60 request/phút/key cho `parse-transaction`.

### Thay đổi hành vi / cần biết
- Shortcut xác thực bằng `Authorization: Bearer vj_…`. `x-shortcut-secret` (legacy) vẫn chạy tới phase 4.
- `parse-transaction`: body > 16.000 ký tự → `413`, JSON hỏng → `400`, lỗi nội bộ trả thông điệp chung (chi tiết chỉ ở log).
- Deploy: `db push` → deploy `parse-transaction` + `delete-account`. Đăng ký trên production **giữ tắt** tới hết phase 3;
  không chạy `supabase config push` (`config.toml` bật đăng ký cho local).

## 2026-10-22 — MCC đầy đủ và sửa giao dịch thẻ

Plan: `plans/261022-1024-full-mcc-list-and-edit-card-transaction/`.

### Thêm
- **Danh sách MCC đầy đủ (~1000 mã)** thay cho 16 nhóm: `src/utils/mcc-codes.ts` sinh bằng `scripts/generate-mcc-codes.py`,
  nhãn tiếng Việt, kèm các mã mới hay gặp trong điều khoản hoàn tiền (6540 nạp ví, 5262, 5552, 6536–6538…).
- **`MccPicker`**: ô chọn MCC có tìm kiếm (mã, nhóm, tên cửa hàng) ở dòng giao dịch thẻ, form rule hoàn tiền và dialog sửa giao dịch.
  Gõ mã 4 số ngoài danh sách vẫn dùng được.
- Thêm từ khoá gợi ý MCC cho các nhóm hay gặp ở VN (hãng bay, khách sạn, mỹ phẩm, trang sức, bảo hiểm, ví điện tử…).
- **Sửa giao dịch thẻ** (`EditCardTransactionDialog`): nơi giao dịch, mô tả, số tiền, chiều, thời điểm, loại, danh mục, MCC.
  Chỉ ghi trường đã đổi.

### Thay đổi hành vi / cần biết
- `MCC_OPTIONS` giờ là toàn bộ danh sách; mã có gợi ý nằm ở `COMMON_MCC_OPTIONS`. Từ khoá gợi ý chuyển sang `mcc-keywords.ts`.
- Rule hoàn tiền nhận mọi MCC 4 chữ số; trước đây chỉ nhận mã trong danh sách.
- Form rule mới, khi rule mặc định đã có, chọn sẵn nhóm hay gặp đầu tiên còn trống (4111) thay vì 5411.
- Điều hướng bàn phím của listbox tách ra `useListboxKeyboard` (dùng chung với bộ chọn thẻ).

## 2026-10-21 — Làm mới giao diện "Ví Jade" và mục Nhiều thẻ

Plan: `plans/261021-1851-ui-visual-identity-refresh/` (7 phase: token, shell, dashboard, thẻ, danh sách, nhiều thẻ, motion/QA).

### Thêm
- **Bảng màu "Ví Jade"** sáng/tối trong `src/index.css`, màu ngữ nghĩa thu / chi / hoàn tiền / nội bộ / cảnh báo
  (`text-income`, `bg-expense-soft`, `text-cashback`, `bg-internal-soft`, `bg-warning`…). Mọi cặp chữ/nền đạt WCAG AA ở cả hai theme.
- **Font Be Vietnam Pro tự host** (`@fontsource`, import trong `main.tsx`) vì CSP `font-src 'self'` chặn Google Fonts.
- **Điều hướng**: thanh tab dưới `MobileTabBar` cho điện thoại (< `sm`); header và tab dưới cùng đọc `nav-items.ts`. Tiêu đề trang dùng chung `PageHeader`.
- **Màn hình trống** có minh hoạ (`components/empty-state/EmptyState`) cho danh sách giao dịch, hộp tin, dashboard.
- **Tổng quan bố cục bento**: `NetCashFlowCard` (thu − chi ròng, tỉ lệ chi/thu), xếp hạng danh mục, biểu đồ danh mục.
- **Thẻ dạng thẻ vật lý** (`CardVisual`), thanh tiến độ chu kỳ sao kê (`CycleProgress`, đổi màu theo độ gấp), `MeterBar` cho thước hoàn tiền theo bậc/trần.
- **Danh sách giao dịch gọn**: nhóm theo ngày kèm tổng thu/chi từng ngày (`DayGroupHeader`), nút tải thêm (`LoadMoreFooter`).
- **Nhiều thẻ** (`/credit-cards?view=all`): chọn một hoặc nhiều thẻ (`MultiCardPicker` dùng chung `CardSearchListbox` với bộ chọn thẻ đơn),
  xem lịch sử gộp (`MultiCardTransactionList`, `useMultiCardTransactions`). `getCreditCardTransactions` nhận `{ cardIds }`; rỗng = mọi thẻ.
- **Số dòng tiền chạy tăng dần** (`useCountUp`); chuyển động tắt khi người dùng bật giảm chuyển động.

### Sửa
- **Biểu đồ danh mục xám**: màu tra theo khoá tiếng Anh (`food`, `shopping`) trong khi dữ liệu là tên tiếng Việt, mọi lát rơi về màu "Khác".
  Nay `getCategoryChartColor` (`utils/category-colors.ts`) khoá theo 6 Category thật.
- **Giao dịch thẻ dồn hết vào chu kỳ hiện tại**: `groupTransactionsByCycle` nay đặt mỗi giao dịch vào chu kỳ chứa ngày giao dịch.
  Trước đây mọi giao dịch đều hiện trong kỳ đang mở.
- **Khoản trả vào thẻ hiển thị như chi**: khoản trả nợ thẻ nay có dấu + và màu thu.
- **Tràn ngang trên điện thoại** không còn xuất hiện ở `main`.

### Thay đổi hành vi / cần biết
- `groupTransactionsByCycle(txs, currentCycle, statementDay)` thêm tham số `statementDay`. Ai gọi hàm cũ cần truyền thêm.
- `filterStore` có thêm `cardIds`; `resetFilters` cũng reset `cardIds`.
- QueryKey của `useMultiCardTransactions` bắt đầu bằng `['creditCardTransactions']` để optimistic patch MCC và invalidate khi sửa/xoá thẻ vẫn áp dụng. Đổi prefix này sẽ làm hỏng cả hai.
- Chỉ đổi giao diện và phần hiển thị; không có migration DB và không cần deploy Edge Function.

## 2026-10-21 — Sửa theo code review hộp tin chưa phân loại

Plan: `plans/261021-1552-unparsed-inbox-review-followups/`.

### Sửa
- Gợi ý thời điểm cho tin không ghi năm: tin "31/12" nhận ngày 01/01 không còn bị đoán thành 31/12 năm sau
  (cùng quy tắc `inferYear` của edge function).
- `backfill-unparsed.ts`: chỉ đánh dấu tin còn chưa xử lý; user xử lý tin trên web trong lúc script chạy thì
  giao dịch script vừa tạo bị xoá (`lostRace`) — không còn giao dịch trùng. Tin cùng nội dung với giao dịch
  đã gắn tin khác được giữ trong hộp (`duplicateKept`) thay vì làm script dừng; lỗi giữa chừng không xoá nhầm.
- **Edge function — năm của tin không ghi năm** (VPBank, OCB): runtime chạy UTC nên tin "01/01 00:05" nhận lúc
  00:00–07:00 ngày 01/01 giờ VN bị gán năm cũ. `inferYear` giờ lấy năm theo giờ VN. Cần deploy lại function.
- Ngày không tồn tại (29/02 năm thường) trong gợi ý giữ thời điểm nhận tin.

### Thêm
- CSV có cột **Dòng tiền** (Nội bộ / Cashback / trống) ngay sau cột Loại, để đối chiếu với Tổng quan
  (Tổng quan không tính giao dịch Nội bộ).

### Refactor (không đổi hành vi)
- `src/services/mappers.ts` → thêm `api-errors.ts`, `query-cursor.ts`; edge function → `parsers-card-sms.ts`,
  `shortcut-auth.ts`. Replay 99 tin thật trước/sau giống hệt.

### Đã chạy trên production (21/10/2026)
- Deploy lại `parse-transaction`; `backfill-unparsed.ts --apply` trên 120 tin: 6 giao dịch thẻ mới (OCB ×3 và
  Sacombank trả nợ = nội bộ, Cake ×2 chi), 23 tin chờ tài khoản (BIDV ****3946, OCB/SHB/HDBank ****0265,
  Vietinbank ****4982; MoMo ×3 không có số TK), gắn nhãn 77 quảng cáo. Hộp tin mặc định: 37 tin. 0 giao dịch mồ côi.

### Giới hạn đã biết
- `OWNER_NAMES` chưa đặt trên production: trả nợ thẻ từ TK ngân hàng vẫn tính là chi, chuyển giữa TK của mình
  đếm cả thu lẫn chi. Xem bảng sự cố trong `ios-shortcut-setup.md`.

## 2026-10-21 — Giao dịch ngân hàng: parser push, hộp tin chưa phân loại, tài khoản

Plan: `plans/261021-0940-unparsed-inbox-bank-tab/`.

### Thêm
- **Parser push "biến động số dư"** (`parsers-balance-notifications.ts`): BIDV SmartBanking, Vietinbank,
  OCB (TK + thẻ tín dụng), SHB SAHA, HDBank TK, Cake thẻ tín dụng, Sacombank Pay trả nợ thẻ.
- **Chuẩn hoá NFC** đầu vào edge function: phần lớn thông báo iOS là NFD nên regex không khớp. Đo trên 99 tin
  thật: 0 → 27 tin parse được (cả parser MoMo cũ giờ khớp).
- **`transactions.kind`** (`normal` / `internal_transfer` / `cashback`); `get_dashboard_stats` bỏ
  `internal_transfer` khỏi thu/chi. Tự gắn khi nội dung có "THANH TOAN THE TIN DUNG" hoặc tên trong secret
  `OWNER_NAMES` là người gửi (tiền vào) / người nhận (tiền ra). Khoản chi chỉ có tên mình là người gửi vẫn là
  `normal` (có thể là chuyển cho người khác).
- **Hộp tin chưa phân loại**: `unparsed_messages` có `user_id`, `suggested_kind` (gợi ý lúc nạp:
  giao dịch / nhắc thẻ / quảng cáo / chưa rõ), `kind`, `transaction_id`; RLS chính chủ, grant theo cột,
  trigger khoá tin đã xử lý. RPC `resolve_unparsed` tạo giao dịch + đánh dấu tin nguyên tử.
- **Tab "Giao dịch ngân hàng"**: mục *Chưa phân loại* (mặc định, badge số tin, ẩn quảng cáo) và *Đã ghi nhận*.
  Dialog ghi giao dịch điền sẵn số tiền / chiều / thời điểm, chọn sẵn TK/thẻ khớp đuôi số.
- **Thêm / sửa / xoá tài khoản ngân hàng**; xoá kèm giao dịch qua RPC `delete_bank_account`. Số TK ép mask
  `****xxxx` (form + check constraint).
- `backfill-unparsed.ts`: chạy lại tin cũ qua parser hiện tại (dry-run mặc định, chỉ ghi giao dịch khi
  resolve được TK/thẻ, ngày theo `received_at` với tin không ghi ngày).
- Test: `supabase/tests/unparsed-accounts-rls.sql` (2 user), Deno test parser/classify, integration hộp tin.

### Thay đổi hành vi / cần biết khi deploy
- Edge function **không còn ghi giao dịch mồ côi**: parse được nhưng chưa có TK/thẻ khớp (hoặc khớp nhiều) → vào hộp
  tin với `reason = no_account`. MoMo (không có số TK trong tin) vì vậy luôn vào hộp tin để user chọn nguồn tiền.
  Tin gửi lặp trong 10 phút cũng không tạo 2 dòng trong hộp.
- **Thứ tự deploy:** `supabase db push` (migration `20261021100000`) rồi **ngay** `supabase functions deploy
  parse-transaction`. Edge function cũ không ghi `user_id` → sau migration, tin không parse được bị NOT NULL
  chặn (mất tin) cho tới khi deploy function mới.
- Secret mới (tuỳ chọn): `supabase secrets set OWNER_NAMES="NGUYEN VAN A"` (phân tách `;`).
- Sau deploy: tạo TK/thẻ khớp đuôi số, chạy `backfill-unparsed.ts` dry-run rồi `--apply`.
- Integration test cần `VITE_TEST_SERVICE_ROLE_KEY` (key **local**) trong `.env.test.local`.

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
