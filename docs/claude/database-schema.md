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

**Credit (migration 20261030100000):** mỗi giao dịch do parser ghi THÀNH CÔNG (API key hoặc `x-shortcut-secret` — cùng RPC) trừ 1.
OTP / trùng / promo / no_match / invalid / no_account miễn phí; `resolve_unparsed` (user tự phân loại) cũng miễn phí NHƯNG từ chối
tin `reason = 'no_credit'` (22023) — nếu không, hết credit thì tự resolve từng tin treo là ghi miễn phí.
- `ingest_transaction(p_user, p_tx jsonb, p_refs jsonb, p_source)` → `{status:'inserted'|'held', id}` | `{status:'held_full'}`:
  khoá hàng số dư (`FOR UPDATE`) → còn ≥ 1: insert giao dịch + `_apply_credit(-1,'usage', tx.id)`; hết: lưu `unparsed_messages`
  (`no_credit` + `parsed_payload`), trần 300 tin treo/user (đếm trong cùng khoá) → `held_full` (HTTP 402). `p_refs` đúng một của
  `account_id`/`card_id` và PHẢI thuộc `p_user` (service_role bỏ qua RLS nên kiểm trong `_insert_parsed_tx`, lỗi `P0002`).
- `replay_held_messages(p_user)` → số giao dịch đã ghi: tin treo cũ nhất trước, tới khi hết credit; TK/thẻ đã xoá trong lúc treo →
  reason đổi `no_account` (không trừ). Phase 3 gọi sau khi nạp; phase 2 gọi tay (SQL / service role).
- `_apply_credit(p_user, p_delta, p_kind, p_ref)` → bool: ghi sổ cái `on conflict (kind, ref) do nothing` (false = đã áp, KHÔNG cộng lần 2)
  rồi cộng số dư (âm → CHECK 23514, rollback cả dòng sổ cái). `_ensure_credit_account(p_user)`: tạo ví + tặng `welcome_credits`
  (`ref = 'welcome:'||id`, idempotent) — gọi từ trigger `handle_new_user`, backfill của migration, và tự chữa khi ingest thiếu hàng số dư.
- Mọi hàm trên + `admin_adjust_credit`, `admin_user_ledger`: **chỉ `service_role`**, `security invoker`.
- `admin_adjust_credit(p_admin, p_user, p_delta, p_reason)` → số dư mới: ghi audit `adjust_credit` rồi `_apply_credit(delta,'adjust','audit:'||audit.id)`
  CÙNG transaction; trừ quá số dư → `22003` (rollback cả audit); delta 0 → `22023`. `admin_user_stats` trả thêm `credit_balance`, `credit_unlimited`.

**Chủ app "không giới hạn" (`credit_balances.unlimited`):** `ingest_transaction` / `replay_held_messages` ghi KHÔNG trừ (không có dòng sổ cái —
`delta <> 0` nên không ghi dòng 0) và không bao giờ giữ tin; áp cho cả đường API key lẫn legacy vì cùng một RPC. UI hiện "Không giới hạn".
Không role client nào có quyền ghi cột này — chỉ SQL / service_role. Một dòng SQL (thay `<uuid>` bằng `auth.users.id` của chủ):
```sql
update public.credit_balances set unlimited = true where user_id = '<uuid>';   -- gỡ: set unlimited = false
```
Backfill của migration cấp ví + credit chào mừng cho mọi user có sẵn → deploy không chặn ai. Seed integration (gitignored) KHÔNG cần sửa:
test credit tự đưa số dư về 1 rồi khôi phục.

**RPC:** `get_dashboard_stats(p_date_from, p_date_to)` → JSON khớp `DashboardStatsSchema`.
`delete_credit_card(p_card_id)` → số giao dịch đã xoá: xoá thẻ **kèm toàn bộ giao dịch** nguyên tử (khoá dòng
thẻ trước), lỗi `P0002` nếu thẻ không tồn tại / của người khác. **Xoá thẻ luôn qua RPC này**, không `delete`
trần: FK `transactions.card_id` là `on delete set null` nên giao dịch thành mồ côi (xem cảnh báo bên dưới).
`save_cashback_rule(p_card_id, p_rule_id, p_mcc, p_rate, p_min, p_cap, p_tiers jsonb)` → id rule: lưu rule **và thay toàn bộ bậc**
trong một transaction (bậc tăng dần chặt, bậc đầu > `p_min`, ≤ 5 bậc, sai → `22023`; rule lạ → `P0002`). **Ghi rule hoàn tiền luôn
qua RPC này**; vì nó thay toàn bộ bậc nên mọi lời gọi phải gửi đủ danh sách bậc hiện có.
`delete_bank_account(p_account_id)` → như `delete_credit_card` cho TK. `resolve_unparsed(p_msg_id, p_kind, p_tx jsonb)` →
id giao dịch|null: kind normal/internal_transfer/cashback cần `p_tx` {amount ≠0 nguyên, transaction_date ISO **có offset**,
account_id XOR card_id, description?, merchant_name?, category? ∈ 6 Category}; bank_name/source_type lấy từ TK/thẻ;
card_reminder/promo không có p_tx. Lỗi 22023 (tham số / đã xử lý), P0002 (không thấy).
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
