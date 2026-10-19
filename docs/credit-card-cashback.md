# Quản lý thẻ tín dụng, MCC và hoàn tiền ước tính

Trang `/credit-cards` cho phép thêm/sửa/xoá thẻ, gán MCC cho từng giao dịch, và đặt rule hoàn tiền
cho mỗi thẻ để xem số tiền hoàn **ước tính** của chu kỳ sao kê hiện tại.

Migration: `supabase/migrations/20261018140000_card_crud_mcc_cashback.sql` (thẻ, MCC, rule) và
`supabase/migrations/20261019100000_cashback_tiers_card_cap.sql` (bậc thang, trần thẻ, RPC lưu rule).

## 1. Thêm / sửa / xoá thẻ

Form: `src/features/creditCards/CardFormDialog.tsx`. Schema: `src/types/credit-card-form.ts`.
Service: `src/services/credit-card-mutations.ts`. Hook: `src/hooks/useCreditCardMutations.ts`.

### Số thẻ phải khớp SMS ngân hàng
Edge function gắn giao dịch vào thẻ bằng `bank_name = <bank của parser>` **và**
`card_number LIKE '%<account_ref>'` (4 ký tự cuối trong SMS). Sai một trong hai thì giao dịch
được ghi với `card_id = NULL`: **không hiện trong danh sách thẻ nhưng dashboard vẫn đếm**.

Vì vậy form ép:
- `card_number` đúng dạng `****xxxx` (4 dấu `*` + 4 ký tự cuối, chữ/số/ký tự khác đều được, trừ
  khoảng trắng và `*`). Unique ở DB chỉ chặn trùng chính xác; tiền tố `****` là thứ chống việc
  `5678` và `****5678` cùng khớp một `LIKE`.
- `bank_name` được chuẩn hoá hoa/thường theo tên đã biết (`vpbank` → `VPBank`) vì edge function
  so khớp chính xác, phân biệt hoa thường. Tên chưa biết giữ nguyên (ngân hàng chưa có parser vẫn
  hợp lệ). Danh sách tên đã biết: `KNOWN_BANK_NAMES` trong `bank-branding.ts`.
- Sau khi thêm thẻ, hoặc sửa ngân hàng / số thẻ, app gọi `getUnlinkedCount()` và cảnh báo nếu còn
  giao dịch chưa gắn thẻ hay tài khoản nào.

Ràng buộc DB: unique `(user_id, bank_name, card_number)`. `user_id` có default `auth.uid()`,
client **không** gửi `user_id`.

### Xoá thẻ
Xoá thẻ **kèm toàn bộ giao dịch** của thẻ, không hoàn tác. Dialog đếm số giao dịch sẽ mất và bắt gõ
lại tên thẻ. Việc xoá đi qua RPC `delete_credit_card(p_card_id)` (`security invoker`) chứ không
phải hai lời gọi từ client:
- khoá dòng thẻ trước (`for update`), nên một giao dịch đến đồng thời từ edge function sẽ chờ rồi
  lỗi FK thay vì chèn lọt giữa hai lệnh xoá;
- xoá giao dịch rồi xoá thẻ trong một transaction (rule hoàn tiền xoá theo `on delete cascade`);
- thẻ không tồn tại hoặc của người khác → lỗi `P0002` ("Không tìm thấy thẻ"), không thành công im lặng;
- trả về số giao dịch đã xoá.

Nếu xoá thẻ bằng `delete from credit_cards` trần, FK `on delete set null` biến giao dịch thành
mồ côi — đúng lỗi lệch dashboard nói ở trên.

## 2. MCC trên giao dịch

`src/utils/mcc.ts`, `src/features/creditCards/CreditCardTransactionRow.tsx`,
`src/hooks/useUpdateTransactionMcc.ts`.

SMS ngân hàng VN gần như không kèm MCC nên **người dùng gán tay** từ danh sách 16 mã (`MCC_OPTIONS`):

| Mã | Nhóm | Mã | Nhóm |
|---|---|---|---|
| 5411 | Siêu thị | 5732 | Điện tử |
| 5812 | Nhà hàng | 5942 | Sách / Văn phòng phẩm |
| 5814 | Đồ ăn nhanh / cafe | 5912 | Nhà thuốc |
| 5541 | Xăng dầu | 8011 | Y tế |
| 4121 | Taxi / xe công nghệ | 4899 | Giải trí / Streaming |
| 4111 | Giao thông công cộng | 7832 | Rạp phim |
| 5311 | Bách hóa / Trung tâm thương mại | 4900 | Điện nước |
| 5651 | Quần áo | 4814 | Viễn thông |

- Lưu ở cột `transactions.mcc` (4 chữ số, nullable = chưa phân loại; DB có check).
- **MCC độc lập với `Category`** (Ăn uống, Mua sắm…). `categoryOverrideStore` vẫn chỉ nằm ở
  localStorage; MCC thì lưu DB vì rule hoàn tiền phụ thuộc vào nó.
- `suggestMcc(merchantName)` chỉ **gợi ý** bằng một nút bấm, không bao giờ tự lưu. Khớp theo
  **ranh giới từ** (không khớp chuỗi con giữa từ: `shell` không dính "Shellfish"), nhiều từ khoá cùng
  khớp thì lấy từ khoá **dài nhất** (`apple music` thắng `apple`). Từ khoá nhập nhằng
  (`metro`, `gas`) và từ khoá địa điểm (`vincom`, `mall`) cố ý không có. Muốn thêm từ khoá: test
  "mỗi từ khoá gợi ý đúng mục chứa nó" sẽ bắt từ khoá bị mục khác che khuất.
- Cập nhật lạc quan (optimistic) vào mọi trang/bộ lọc đang cache, lỗi thì hoàn tác **đúng giao dịch
  đó** (không khôi phục cả ảnh chụp cache, vì sẽ xoá thay đổi của lần sửa song song).
- Cột `MCC` trong CSV chỉ có ở file xuất của thẻ.

## 3. Rule hoàn tiền

`src/utils/cashback.ts` (logic), `src/services/cashbackRules.ts`, `src/hooks/useCashbackRules.ts`,
`src/hooks/useCycleCashback.ts`, UI: `CashbackRulesEditor`, `CashbackRuleForm`, `CashbackSummary`
(nằm trong `BillingCycleInfoCard`).

### Dữ liệu
Bảng `card_cashback_rules(card_id, mcc, rate_percent, min_cycle_spend, cap_per_cycle)` (kèm bậc thang
thêm ở bảng con, xem dưới):
- `mcc = NULL` là **rule mặc định**, áp cho mọi giao dịch không khớp rule MCC nào (kể cả giao
  dịch chưa gán MCC). Mỗi thẻ chỉ có một rule cho mỗi `mcc`, kể cả `NULL` (`unique nulls not distinct`).
- `rate_percent` 0..100, tối đa 2 số lẻ. `min_cycle_spend` ≥ 0. `cap_per_cycle` null = không giới
  hạn, nếu có thì > 0.
- RLS: rule phải thuộc thẻ của chính user (policy kiểm `credit_cards`), không chỉ `user_id`.

**Bậc thang** — bảng `card_cashback_rule_tiers(rule_id, min_spend, rate_percent)`, tối đa **5 bậc thêm**
mỗi rule. `rate_percent` + `min_cycle_spend` của rule chính là **bậc nền**, nên rule tạo trước khi có bậc
thang vẫn đúng nguyên. `min_spend > 0`, `unique (rule_id, min_spend)`, RLS kiểm rule thuộc user.
Hai bất biến liên dòng không viết được bằng `check` nên do RPC kiểm: bậc **tăng dần chặt** và bậc đầu
**lớn hơn** `min_cycle_spend`.

**Trần cả thẻ** — cột `credit_cards.cashback_monthly_cap` (null = không giới hạn, nếu có thì > 0).

**Ghi rule đi qua RPC** `save_cashback_rule(p_card_id, p_rule_id, p_mcc, p_rate, p_min, p_cap, p_tiers jsonb)`
(`security invoker`): lưu rule và thay **toàn bộ** bậc trong một transaction, nên không có rule nửa vời
(rule đã lưu mà bậc lỗi). `p_rule_id` null = tạo mới; rule của người khác hoặc không khớp thẻ → `P0002`;
bậc sai → `22023` kèm thông điệp tiếng Việt. Vì RPC thay thế toàn bộ bậc, client luôn gửi đủ danh sách bậc
(form giữ lại bậc hiện có khi sửa). Xoá rule vẫn là `delete` thường (bậc xoá theo `on delete cascade`).

### Cách tính (`computeCashback`)
Số tiền hoàn **không lưu**: tính khi đọc từ rule + giao dịch của chu kỳ, nên đổi rule hoặc đổi
MCC thì cập nhật cho cả giao dịch cũ.

1. Chỉ tính giao dịch **chi** (`amount < 0`). Hoàn trả và thanh toán dư nợ (`amount ≥ 0`) bị bỏ
   qua, vì refund thường chưa có MCC nên không biết trừ vào nhóm nào.
2. Mỗi giao dịch thuộc đúng một rule: rule có MCC trùng, không có thì rule mặc định, không có cả hai
   thì vào `unmatchedSpend` và không được hoàn.
3. **Bậc thang và trần áp riêng cho từng rule**, theo chu kỳ sao kê. Chi của nhóm `< min_cycle_spend`
   → hoàn 0 (`belowMin`; đúng bằng ngưỡng thì được hoàn). Ngược lại lấy **bậc cao nhất có
   `minSpend ≤ chi`** (bậc nền + các bậc thêm, sắp theo mức chi; không tin thứ tự đầu vào) và áp % của
   bậc đó cho **cả khoản chi** — *không lũy tiến*. Rồi hoàn `chi × %` chặn ở `cap_per_cycle` (`capped`).
4. Cộng các rule, rồi cắt ở **trần cả thẻ** (`cashback_monthly_cap`): thứ tự là **trần rule trước, trần
   thẻ sau**. Phần bị cắt không phân bổ ngược về từng rule; kết quả có `uncappedTotal`, `cardCapped`.
5. Làm tròn **xuống đồng**, trên **tổng của rule** (không làm tròn từng giao dịch), bằng **điểm cơ
   bản nguyên** (`% × 100`). Không dùng số thực: `0,57% × 1.000.000` cho `5.699` thay vì `5.700`.

**Vách đá:** vì % của bậc áp cho cả khoản chi, qua mốc là số hoàn nhảy vọt. Với nền `≥5tr → 0,5%` và
bậc `≥10tr → 1%`: chi 9.999.999đ hoàn 49.999đ, chi 10.000.000đ hoàn 100.000đ. Đúng với kiểu thẻ "chi từ X
hoàn Y%" của ngân hàng; không phải lỗi. UI hiển thị "Còn X nữa để lên bậc Y%" để người dùng thấy mốc.

Kết quả luôn hiển thị là **"ước tính"** vì mỗi ngân hàng làm tròn và hạch toán khác nhau. Chưa hỗ trợ
(cố ý, YAGNI): rule theo merchant, bậc lũy tiến từng phần, kỳ tính theo tháng dương lịch (luôn là chu kỳ
sao kê), phân bổ phần bị cắt ở trần thẻ, trừ refund vào nhóm MCC.

### Chu kỳ sao kê
Khoảng giao dịch của chu kỳ là **nửa mở `[startISO, endISO)`** (đầu kỳ = 00:00 VN ngày sau ngày sao
kê trước). Truy vấn dùng `dateFrom` + `dateBefore` (cận trên loại trừ, thêm vào `TransactionFilters`).
`computeCurrentCycle` **kẹp ngày sao kê vào độ dài tháng**: thẻ sao kê ngày 31 thì tháng 4 cắt ngày
30, tháng 2 cắt 28/29. Bản cũ để `Date.UTC(2026, 3, 31)` tràn sang 1/5 làm chu kỳ sai.

`BillingCycleInfoCard` dùng `useNow()` (tick 60 giây) nên tab mở qua mốc cắt sẽ sang chu kỳ mới. Khoá
truy vấn chứa ranh giới chu kỳ chứ không phải "bây giờ", nên chỉ tải lại khi chu kỳ đổi.

Giao dịch của chu kỳ lấy qua `exportTransactions` (tự lật trang 500 dòng, tối đa 100 trang). Vượt
50.000 dòng thì **báo lỗi** thay vì trả mảng thiếu.

### Query key và làm mới
| Key | Đổi khi |
|---|---|
| `['cashbackRules', cardId]` | thêm/sửa/xoá rule (kèm bậc); sửa/xoá thẻ |
| `['creditCards']` | đặt/bỏ trần cả thẻ (Summary tính lại ngay từ `card.cashbackMonthlyCap`, không tải lại giao dịch) |
| `['cardCycleExpenses', cardId, start, end]` | đổi MCC; sửa/xoá thẻ |
| `['creditCardTransactions', …]` | đổi MCC; thêm/sửa/xoá thẻ |
| `['creditCardTxCount', cardId]` | luôn lấy mới khi mở dialog xoá |

Giới hạn đã biết: một SMS mới đến lúc trang đang mở **không** làm số ước tính tự cập nhật.
`App.tsx` cố ý tắt refetch khi focus và để `staleTime` 5 phút; chu kỳ mới thì có làm mới.

## 4. Bảo mật

- `credit_cards`: `authenticated` có `select, insert, update, delete`; mọi policy `auth.uid() = user_id`.
- `transactions`: policy insert/update kiểm thêm `card_id` / `account_id` **thuộc chính user**. Trước
  đây chỉ kiểm `user_id`, nên user A trỏ được giao dịch vào thẻ của B rồi bị `set null` khi B xoá thẻ.
  Edge function dùng `service_role` (bypass RLS) nên không bị ảnh hưởng.
- `card_cashback_rules` và `card_cashback_rule_tiers`: RLS bật, `anon` bị `revoke all`, `authenticated`
  chỉ có 4 quyền CRUD; bậc phải thuộc rule của chính user (FK một mình cho phép gắn bậc vào rule người khác).
- RPC `delete_credit_card` và `save_cashback_rule`: `security invoker`, **không** đổi sang `security definer`.
- Cột `cashback_monthly_cap` nằm trên `credit_cards` nên dùng lại policy update của chủ thẻ.

## 5. Kiểm thử

| Loại | File | Ghi chú |
|---|---|---|
| Unit / render | `src/**/*.test.{ts,tsx}` | `cashback.test.ts`, `cashback-tiers.test.ts` (vách đá, thứ tự cắt trần), `mcc.test.ts`, `billingCycle.test.ts` (quét mọi ngày × ngày sao kê 1..31), các test dialog/trang |
| Integration | `card-crud`, `credit-card-mutations`, `transaction-mcc`, `cashback-rules` `.integration.test.ts` | Cần Supabase local, xem `CLAUDE.md` |
| RLS chéo 2 user | `supabase/tests/card-crud-rls.sql`, `supabase/tests/card-cashback-tiers-rls.sql` | Chạy trên Postgres tạm, hướng dẫn ở đầu file (file thứ hai tự chứa, dùng ID riêng) |

Quy ước khi viết test cho phần này:
- Các file integration **dùng chung DB** với `services.integration.test.ts` (assert tổng cố định theo
  seed). Mọi dữ liệu tạo ra phải được dọn, kể cả khi test fail giữa chừng (`afterAll` + dọn dữ liệu sót
  ở `beforeAll`, xoá thẻ bằng RPC `delete_credit_card`).
- Form dài: điền bằng `fireEvent.change` thay vì `userEvent.type` từng phím. Gõ ~40 ký tự mất ~0,4s
  khi chạy riêng nhưng chậm gấp chục lần khi cả bộ chạy song song, đủ vượt timeout 5s.
- Component mới dùng hook thật cần một test **mount thật** (xem `BillingCycleInfoCard + hoàn tiền`
  trong `CashbackSummary.test.tsx`): repo từng có render loop lọt qua hàng trăm test xanh vì không test
  nào mount component đó.
