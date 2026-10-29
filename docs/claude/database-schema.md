<!-- Tách từ CLAUDE.md (import bằng @). Schema Supabase, RPC, RLS, truy vấn giao dịch. -->

## Database Schema (Supabase)

```
transactions
  id uuid PK | user_id → auth.users NOT NULL | bank_name text | amount bigint (VND, dương=thu, âm=chi)
  currency text | transaction_date timestamptz | description text | raw_text text
  source_type 'bank'|'credit_card' | account_ref text (4 ký tự cuối, resolve FK)
  account_id → accounts | card_id → credit_cards   (nullable — xem cảnh báo bên dưới)
  merchant_name text | category text | status 'pending'|'posted' | created_at timestamptz

accounts       id, user_id, bank_name, account_name, account_number, account_type,
               currency, balance bigint, last_updated
credit_cards   id, user_id (default auth.uid()), bank_name, card_name, card_number, card_type, currency,
               credit_limit, current_balance, statement_date (1..31), payment_due_date, last_updated,
               cashback_monthly_cap bigint|NULL (>0; trần hoàn tiền cả thẻ mỗi kỳ, NULL = không giới hạn)
               unique (user_id, bank_name, card_number)
card_cashback_rules  id, user_id, card_id → credit_cards (cascade), mcc text|NULL (NULL = rule mặc định),
               rate_percent numeric(5,2) 0..100, min_cycle_spend bigint, cap_per_cycle bigint|NULL (>0)
               unique nulls not distinct (card_id, mcc)   -- rate_percent + min_cycle_spend = BẬC NỀN
card_cashback_rule_tiers  id, user_id, rule_id → card_cashback_rules (cascade), min_spend bigint (>0),
               rate_percent numeric(5,2) 0..100, unique (rule_id, min_spend) — bậc THÊM, tối đa 5/rule
unparsed_messages  tin không ghi được: user_id NOT NULL, raw_text (thường là NFD), source, reason,
               suggested_kind (máy gợi ý: transaction|card_reminder|promo|unknown), kind (user chốt:
               normal|internal_transfer|cashback|card_reminder|promo), resolved, transaction_id → transactions
               RLS chính chủ: select + update CHỈ cột (resolved, kind, transaction_id); insert chỉ edge function.
               Trigger khoá tin đã resolved (bỏ resolved rồi resolve lại = giao dịch thứ 2)

transactions.kind  'normal'|'internal_transfer'|'cashback' — internal_transfer (chuyển giữa TK/thẻ của mình,
               gồm trả nợ thẻ) KHÔNG tính vào get_dashboard_stats
accounts       unique (user_id, bank_name, account_number), check mask '^\*{4}[^\s*]{4}$', user insert/delete được
user_settings  user_id PK (trigger handle_new_user tạo lúc đăng ký), owner_names text[] (≤ 10 tên, mỗi tên 3..100 ký tự,
               không NULL — CHECK owner_names_ok), privacy_consent_at, privacy_policy_version. User chỉ sửa owner_names
api_keys       id, user_id, name, prefix ('vj_'+6), last4, key_hash bytea UNIQUE (SHA-256), last_used_at, revoked_at, rl_*
               authenticated KHÔNG đọc key_hash/rl_* (select('*') = 42501 → dùng danh sách cột), chỉ sửa name/revoked_at;
               trigger api_keys_guard: tối đa 10 key còn hiệu lực/user, thu hồi là vĩnh viễn
user_settings.suspended_at  admin khoá user (user đọc được, không sửa được). Lý do khoá CHỈ ở admin_audit_log — user đọc
               được user_settings nên không đặt ghi chú nội bộ của admin ở đây
admin_audit_log  id, admin_id, action 'suspend'|'unsuspend'|'revoke_keys'|'view_user'|'adjust_credit', target_user_id (KHÔNG FK — sống sau khi xoá
               user), reason (5..500, bắt buộc), payload jsonb (không email/nội dung giao dịch), created_at.
               Append-only (trigger chặn update/delete/truncate cả service_role); RLS bật, không policy, chỉ service_role

transactions.mcc  text|NULL, 4 chữ số — USER gán tay (SMS ngân hàng VN không có MCC)

credit_ledger   id bigint identity, user_id, delta int (≠ 0), kind 'grant'|'purchase'|'usage'|'refund'|'adjust', ref text,
               created_at, unique (kind, ref) — idempotency. APPEND-ONLY (trigger chặn UPDATE/TRUNCATE kể cả service_role)
credit_balances user_id PK, balance int (CHECK >= 0), unlimited bool default false, updated_at — cache của sum(delta), cập nhật
               CÙNG transaction với dòng sổ cái. Bất biến: balance = sum(delta). authenticated chỉ SELECT own (không ghi gì)
credit_settings 1 dòng (id boolean PK = true): welcome_credits int ≥ 0 (seed 100) — sửa bằng SQL, không deploy. Không policy, không grant client
unparsed_messages.parsed_payload jsonb {tx, refs} — chỉ có khi reason = 'no_credit' (tin hợp lệ bị giữ vì hết credit)
```

**Credit (migration 20261030100000 + sửa lỗi bảo mật 20261101100000):** mỗi giao dịch GHI THÀNH CÔNG trừ 1 credit. **Chỉ có 2 đường ghi
`transactions`**: parser/backfill (`ingest_transaction`, service_role) và phân loại thủ công (`resolve_unparsed_charged`, service_role). `authenticated`
**không có quyền INSERT `transactions`** (đã `revoke insert` + bỏ policy `own_tx_insert`; vẫn select/update/delete giao dịch của mình) — seed test
integration phải dùng service_role. OTP / trùng / promo / no_match / invalid / no_account miễn phí; phân loại thủ công TỐN 1 (xem dưới).
- `ingest_transaction(p_user, p_tx jsonb, p_refs jsonb, p_source)` → `{status:'inserted'|'held', id}` | `{status:'held_full'}`:
  khoá hàng số dư (`FOR UPDATE`) → nếu có tin treo và còn credit thì `replay_held_messages` TRƯỚC (tin mới không chen hàng; replay lỗi chỉ
  cảnh báo) → còn ≥ 1: insert giao dịch + `_apply_credit(-1,'usage', tx.id)`; hết: lưu `unparsed_messages`
  (`no_credit` + `parsed_payload`), trần 300 tin treo/user (đếm trong cùng khoá) → `held_full` (HTTP 402, tin KHÔNG lưu — chấp nhận, Shortcut sẽ báo lỗi).
  `p_refs` đúng một của `account_id`/`card_id` và PHẢI thuộc `p_user` (service_role bỏ qua RLS nên kiểm trong `_insert_parsed_tx`, lỗi `P0002`;
  edge function đổi `P0002`/`23503` thành tin `no_account` thay vì 500).
- `replay_held_messages(p_user)` → số giao dịch đã ghi: tin treo cũ nhất trước, tới khi hết credit. Mỗi dòng một subtransaction: TK/thẻ đã xoá
  (`P0002`/FK) → `reason = 'no_account'`; payload hỏng (class 22 / 23: `22023`, `22P02`, `22007`...) → `reason = 'invalid_payload'` + cảnh báo —
  cả hai ra khỏi hàng đợi, hiện ở hộp tin để user tự phân loại (tốn 1 credit). Gọi từ: `fulfill_order` (nạp), `admin_adjust_credit` (cộng), `ingest_transaction`.
- `resolve_unparsed_charged(p_user, p_msg_id, p_kind, p_tx jsonb)` → id giao dịch|null (**thay `resolve_unparsed`, đã DROP** — không để lại đường ghi
  miễn phí chờ ai grant nhầm). Chỉ `service_role`, gọi qua edge function `resolve-unparsed` (user từ JWT). Khoá số dư rồi tới tin (cùng thứ tự ingest/replay);
  kind normal/internal_transfer/cashback cần `p_tx` {amount ≠0 nguyên, transaction_date ISO **có offset**, account_id XOR card_id THUỘC `p_user`,
  description?, merchant_name?, category? ∈ 6 Category} và TRỪ 1 (`usage`, ref = id giao dịch; unlimited miễn phí); card_reminder/promo miễn phí.
  Lỗi: `22003` hết credit (báo sau khi đầu vào hợp lệ) | `42501` user bị khoá (kiểm `user_settings.suspended_at` tường minh — service_role bỏ qua
  RLS `not_suspended`) | `P0002` tin/TK/thẻ không thấy hoặc không của user | `22023` tham số sai / đã xử lý / tin `no_credit`.
- `discard_backfilled_tx(p_user, p_tx_id)` → bool: xoá giao dịch + hoàn credit (`refund`, ref = tx id) trong MỘT transaction, chạy lại an toàn (backfill `lostRace`).
- `_apply_credit(p_user, p_delta, p_kind, p_ref)` → bool: ghi sổ cái `on conflict (kind, ref) do nothing` (false = đã áp, KHÔNG cộng lần 2)
  rồi cộng số dư (âm → CHECK 23514, rollback cả dòng sổ cái). `_ensure_credit_account(p_user)`: CHỈ tạo hàng ví (số dư 0).
  `_grant_welcome_credit(p_user)`: tặng `welcome_credits` (`ref = 'welcome:'||id`, idempotent).
- **Credit chào mừng chỉ sau khi xác nhận email:** trigger `handle_new_user` (insert `auth.users`) tặng nếu `email_confirmed_at` không null; trigger
  `on_auth_user_confirmed` (update `email_confirmed_at` null → có giá trị) tặng khi xác nhận. Local `enable_confirmations = false` → GoTrue xác nhận ngay lúc
  đăng ký → hành vi như cũ (100 credit). **Production phải bật confirmations + SMTP** (phase 4) — nếu không, rào chống tạo nhiều TK lấy credit không có tác dụng.
- Mọi hàm trên + `admin_adjust_credit`, `admin_user_ledger`: **chỉ `service_role`**, `security invoker`. Trigger `guard_unparsed_update` chặn
  `authenticated` đánh dấu `resolved` lên tin `no_credit` bằng UPDATE trực tiếp (chỉ replay / RPC resolve mới được).
- `admin_adjust_credit(p_admin, p_user, p_delta, p_reason)` → số dư mới SAU replay: ghi audit `adjust_credit` rồi `_apply_credit(delta,'adjust','audit:'||audit.id)`
  CÙNG transaction; delta > 0 thì `replay_held_messages` (khối EXCEPTION: replay lỗi không rollback điều chỉnh); trừ quá số dư → `22003` (rollback cả audit);
  cộng vượt int4 → `22023`; delta 0 → `22023`. `admin_user_stats` trả thêm `credit_balance`, `credit_unlimited`.
- Sổ cái `credit_ledger` không có trigger chặn DELETE vì xoá user cascade qua FK cần xoá được dòng (UPDATE/TRUNCATE bị chặn, DELETE chỉ owner/service_role).
- Trần điều chỉnh admin có 2 bản vì Deno/web không import chung: `MAX_CREDIT_DELTA` (admin-actions.ts) = `MAX_CREDIT_ADJUST` (src/types/admin.ts); test `credit-delta-limit.test.ts` so khớp.

**Chủ app "không giới hạn" (`credit_balances.unlimited`):** `ingest_transaction` / `replay_held_messages` ghi KHÔNG trừ (không có dòng sổ cái —
`delta <> 0` nên không ghi dòng 0) và không bao giờ giữ tin; áp cho cả đường API key lẫn legacy vì cùng một RPC. UI hiện "Không giới hạn".
Không role client nào có quyền ghi cột này — chỉ SQL / service_role. Một dòng SQL (thay `<uuid>` bằng `auth.users.id` của chủ):
```sql
update public.credit_balances set unlimited = true where user_id = '<uuid>';   -- gỡ: set unlimited = false
```
Backfill của migration cấp ví + credit chào mừng cho mọi user có sẵn → deploy không chặn ai. Seed integration (gitignored) KHÔNG cần sửa:
test credit tự đưa số dư về 1 rồi khôi phục; test phân loại hoàn credit đã trừ ở cleanup (`src/test/integration-resolve.ts`).

**RPC:** `get_dashboard_stats(p_date_from, p_date_to)` → JSON khớp `DashboardStatsSchema`.
`delete_credit_card(p_card_id)` → số giao dịch đã xoá: xoá thẻ **kèm toàn bộ giao dịch** nguyên tử (khoá dòng
thẻ trước), lỗi `P0002` nếu thẻ không tồn tại / của người khác. **Xoá thẻ luôn qua RPC này**, không `delete`
trần: FK `transactions.card_id` là `on delete set null` nên giao dịch thành mồ côi (xem cảnh báo bên dưới).
`save_cashback_rule(p_card_id, p_rule_id, p_mcc, p_rate, p_min, p_cap, p_tiers jsonb)` → id rule: lưu rule **và thay toàn bộ bậc**
trong một transaction (bậc tăng dần chặt, bậc đầu > `p_min`, ≤ 5 bậc, sai → `22023`; rule lạ → `P0002`). **Ghi rule hoàn tiền luôn
qua RPC này**; vì nó thay toàn bộ bậc nên mọi lời gọi phải gửi đủ danh sách bậc hiện có.
`delete_bank_account(p_account_id)` → như `delete_credit_card` cho TK. Phân loại tin hộp thư: `resolve_unparsed_charged` (mục Credit ở trên;
bank_name/source_type lấy từ TK/thẻ; card_reminder/promo không có p_tx).
`create_api_key(p_name)` → key `vj_…` đầy đủ (lần DUY NHẤT; DB chỉ giữ SHA-256). `authenticate_api_key(p_key_hash hex)` →
(user_id, owner_names, rate_limited, suspended): **chỉ `service_role`** (revoke khỏi public/anon/authenticated), một UPDATE…RETURNING tăng bộ
đếm rate limit 60/phút/key + `last_used_at`; 0 dòng = key sai/đã thu hồi.
`authenticate_api_key` trả thêm `suspended` → parse-transaction `403 suspended` (tin KHÔNG lưu, kiểm trước rate limit).
`admin_user_stats(p_user_ids)` (chỉ count/max; `tx_count_30d` chỉ giao dịch PARSER ghi — không đếm giao dịch user ghi từ hộp tin),
`admin_user_keys`, `admin_set_suspended`, `admin_revoke_user_keys`, `admin_log_view`, `admin_list_audit`: **chỉ `service_role`**, mỗi thay đổi ghi audit CÙNG transaction; gọi qua edge function `admin`.
Mọi RPC dùng `security invoker` để tôn trọng RLS — **không được đổi sang `security definer`**. Ngoại lệ DUY NHẤT: trigger
`handle_new_user` trên `auth.users` (mẫu chuẩn Supabase, chạy dưới role GoTrue, không gọi được như RPC).
Từ migration `20261029100000` function mới **không** tự có EXECUTE cho PUBLIC/anon → mỗi RPC mới phải
`grant execute ... to authenticated` (hoặc `service_role`) tường minh; `admin-rls.sql` fail nếu anon gọi được function nào.

**RLS:** mọi bảng bật RLS, policy `auth.uid() = user_id`. `anon` bị `revoke all`.
**KHÔNG thêm policy "admin bypass"** vào bảng nào: admin chỉ đi qua edge function `admin` (service role) — 1 policy admin
sai là lộ giao dịch của mọi user, và admin theo quyết định chỉ được thấy metadata (không số tiền/mô tả/raw_text).
Policy **RESTRICTIVE** `not_suspended` (`not (select is_suspended())`) trên transactions, accounts, credit_cards,
card_cashback_rules, card_cashback_rule_tiers, unparsed_messages, api_keys, credit_ledger, credit_balances: AND với policy cũ để khoá có hiệu lực NGAY cả với
access token còn hạn (ban GoTrue chỉ chặn đăng nhập + refresh — đã kiểm: REST vẫn 200 sau ban). Bảng mới chứa dữ liệu user
phải thêm vào danh sách này (migration 20261028100000). `user_settings` cố ý KHÔNG gắn (UI cần đọc cờ khoá).
`transactions` insert/update kiểm thêm `card_id`/`account_id` **thuộc chính user**; `card_cashback_rules`
insert/update kiểm thẻ thuộc user; `card_cashback_rule_tiers` kiểm rule thuộc user. Chỉ kiểm `user_id` là chưa đủ: FK vẫn chấp nhận trỏ sang thẻ của
người khác, và khi họ xoá thẻ thì giao dịch bị `set null` thành mồ côi.
`transactions.user_id` là **NOT NULL** — row user_id null sẽ vô hình với mọi policy
(`auth.uid() = null` → NULL) và không cách nào xoá từ client.

**Truy vấn giao dịch:** dùng `TX_COLUMNS` (`src/services/transactionQuery.ts`), **không dùng
`select('*')`** — `*` kéo cả `raw_text` (nguyên văn SMS: số dư, tên người chuyển) về browser
dù không mapper nào đọc. `countOption(cursor)` chỉ đếm ở trang đầu, vì `totalForPage()`
vứt bỏ count từ trang 2 trở đi. Cỡ trang "Xem thêm" của mọi danh sách giao dịch: `TX_PAGE_SIZE` (= 20, cùng file).
`getCreditCardTransactions(card: string | { cardIds })`: `cardIds` rỗng = mọi thẻ của user (RLS giới hạn); keyset
`(transaction_date, id)` vẫn đúng khi gộp nhiều thẻ.

⚠️ **`account_number`/`card_number` phải kết thúc bằng đúng `account_ref` mà parser bắt được**
(vd LPBank → `****x265`). Sai format thì edge function không resolve được FK, và hậu quả
KHÔNG hiển nhiên: giao dịch đó **không hiện trong danh sách** (mọi query lọc theo
`account_id`/`card_id`) nhưng **vẫn được dashboard đếm** → tổng thu/chi lệch với danh sách.
Dùng `getUnlinkedCount()` (`src/services/accounts.ts`) để phát hiện.

Form thẻ (`credit-card-form.ts`) vì thế **ép `card_number` dạng `****xxxx`** (unique ở DB chỉ chặn trùng chính xác, còn
`5678` và `****5678` cùng khớp một `LIKE`) và **chuẩn hoá hoa/thường `bank_name`** theo `KNOWN_BANK_NAMES`
(`bank-branding.ts`): edge function so khớp `bank_name` bằng `.eq()` chính xác, phân biệt hoa thường.

---

## Thanh toán credit (migration `20261031100000`)

```
credit_packages  id text PK, credits, price_vnd (1.000..50.000.000), active, sort — sửa bằng SQL (seed p50k=500, p100k=1.200, p200k=3.000).
                 authenticated chỉ SELECT gói active; không grant ghi
payment_orders   id, user_id, provider 'momo'|'zalopay', provider_order_ref UNIQUE ('yymmdd_' GMT+7 + 12 [a-z0-9]; = MoMo orderId/requestId,
                 ZaloPay app_trans_id), provider_tx_id (transId / zp_trans_id), package_id, amount_vnd + credits (CHỤP từ gói lúc tạo),
                 status pending|paid|expired|failed|mismatch, pay_url, paid_at, last_checked_at, expires_at (+15 phút)
                 unique (provider, provider_tx_id) = khoá idempotency của IPN. RLS: select chính chủ + RESTRICTIVE not_suspended;
                 authenticated KHÔNG insert/update/delete (status chỉ đổi qua RPC service_role)
payment_events   log mọi create/ipn/query (payload đã lọc key/chữ ký). RLS bật, không policy, không grant client
```
**RPC (chỉ `service_role`, security invoker):** `create_payment_order(user, provider, package)` (≤ 5 đơn pending chưa hết hạn → 22023, user khoá → 42501,
gói lạ → P0002), `get_payment_order`, `set_order_pay_url`, `fail_payment_order`, `mark_order_checked`, `log_payment_event`,
`list_orders_to_reconcile`, `expire_stale_orders` (chỉ đơn quá hạn VÀ đã được hỏi provider SAU hạn), và
`fulfill_order(provider, order_ref, tx_id, amount)` → `paid|duplicate|mismatch|unknown_order`:
tx_id đã thấy → duplicate; khoá dòng đơn rồi kiểm lại (2 IPN song song); lệch tiền / quá hạn / đơn không còn pending → `mismatch`, KHÔNG cộng
(đơn đã `paid` mà tới tx khác thì trả mismatch nhưng GIỮ `paid`); còn lại → paid + `_apply_credit(+credits,'purchase', order.id)` (ref = đơn → cộng đúng 1 lần
ngay cả khi lớp trên hỏng) + `replay_held_messages` trong khối EXCEPTION (replay lỗi chỉ cảnh báo, không rollback credit đã trả).
**Xử lý đơn `mismatch` (chưa có tab admin):** xác minh ở cổng thanh toán + `payment_events`, rồi cộng tay bằng action `adjust_credit` của function `admin`
(ghi audit) hoặc đánh dấu hoàn tiền ngoài app; không có đường tự động.

**Retention `raw_text` (migration `20261102100000`):** `purge_raw_text(p_days int default 30)` → `{transactions, unparsed_messages}`:
`transactions.raw_text = NULL` (cũ hơn N ngày theo `created_at`); tin hộp tin **đã resolved** cũ hơn N ngày (`received_at`) →
`raw_text = ''` (cột NOT NULL) + `parsed_payload = NULL`. **Không bao giờ đụng tin chưa resolved**: tin `no_credit` đang treo cần
`parsed_payload` để replay, tin lạ cần `raw_text` để user phân loại. Theo lô 1000 dòng (`for update skip locked`). Chỉ `service_role`.
Không ảnh hưởng chống trùng (cửa sổ 10 phút) và `backfill-unparsed` (chỉ đọc tin chưa resolved; chỉ lệch khi tin chưa resolved
> N ngày có giao dịch mồ côi do lần chạy trước crash — `findExisting` so `raw_text` đã bị xoá nên sẽ không nhận ra). Lịch `pg_cron`
`purge-raw-text` `0 20 * * *` (= 03:00 ICT) chỉ được tạo khi `pg_available_extensions` có `pg_cron` (local Supabase có; migration KHÔNG fail
nếu thiếu). **Production:** bật Database → Extensions → `pg_cron`, rồi chạy lại khối `do $cron$` cuối file migration (hoặc
`select cron.schedule('purge-raw-text','0 20 * * *','select public.purge_raw_text(30)')`); kiểm `select * from cron.job_run_details`.
**`parse_rate_by_source`** (view `security_invoker`, chỉ `service_role`/SQL): mỗi `(window_days 7|30, source)` có `inserted`, `held`
(no_credit chưa replay), `no_match`, `invalid` (`invalid_parse`/`invalid_payload`), `no_account`, `parse_rate_pct`. `inserted` đếm
`transactions.bank_name` trừ giao dịch user tự tạo từ hộp tin; không UI. Đọc: `select * from parse_rate_by_source order by 1,2;`
