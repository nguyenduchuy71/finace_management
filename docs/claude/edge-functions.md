<!-- Tách từ CLAUDE.md (import bằng @). Edge function parse-transaction và admin. -->

## Edge Function (`supabase/functions/parse-transaction/`)

iOS Shortcut POST `{ "text": "<nội dung notification>", "source": "<bank_name>" }` + header
`Authorization: Bearer vj_…` (API key của user, `api-key-auth.ts` → RPC `authenticate_api_key`; Bearer có mặt thì KHÔNG rơi về
legacy). Legacy: `x-shortcut-secret` → `DEFAULT_USER_ID` (chỉ khi đặt cả 2 secret). Body > 16.000 ký tự → 413 trước `JSON.parse`.
`user_settings.owner_names` từ DB **phải** qua `normalizeOwnerNames` (bỏ dấu/in hoa/bỏ null) như env — mô tả giao dịch đã chuẩn hoá. Setup Shortcut (trigger Notification iOS 27 / Message / Email): `docs/ios-shortcut-setup.md`.
Luồng: `normalizeInput` (**NFC** — iOS gửi NFD, regex NFC không khớp) → OTP → chống trùng (cùng `raw_text` trong 10 phút)
→ 19 regex parser → `withKind` (nhận diện chuyển nội bộ, `internal-transfer.ts`, tên chủ TK của user) → resolve TK/thẻ
(phải khớp DUY NHẤT) → insert; **không khớp TK/thẻ thì KHÔNG ghi giao dịch mồ côi** mà vào hộp tin (`reason = no_account`);
chống trùng kiểm cả `transactions` lẫn `unparsed_messages`;
không khớp → `unparsed_messages` kèm `source`, `reason`, `user_id`, `suggested_kind` (`classify-unparsed.ts`, ưu tiên recall:
giao dịch thật không bao giờ bị gắn promo). `ingest.ts` (parse/resolve FK/insert) dùng chung với `backfill-unparsed.ts`
(chạy tay, dry-run mặc định). Parser nhận `now` = thời điểm nhận tin cho tin không ghi ngày/năm.
Parser: LPBank (app + SMS), UOB, Sacombank, MoMo, BIDV (`parsers.ts`) + SHB, HDBank, MSB, VPBank, WOORIVN thẻ
(`parsers-card-sms.ts`) + BIDV push, Vietinbank, OCB TK/thẻ, SHB SAHA, HDBank TK, Cake thẻ, Sacombank Pay trả nợ
(`parsers-balance-notifications.ts`). Thứ tự mảng `parsers` quan trọng (khớp trước thắng). Secret check (legacy + webhook): `shortcut-auth.ts`.
**`OWNER_NAMES` hiện KHÔNG đặt trên production** (user quyết định; user nay tự nhập ở trang Cài đặt): BIDV trả nợ thẻ tính là chi, chuyển giữa TK của mình
đếm cả thu lẫn chi — chỉ "THANH TOAN THE TIN DUNG" và Sacombank Pay trả nợ được gắn nội bộ.
Bank xác định bằng đuôi thẻ/TK đối chiếu `credit_cards` — không đoán theo giọng văn.
Thứ tự deploy với migration 20261021100000: db push rồi deploy function ngay (function cũ không ghi user_id).

**Giới hạn `text` 2000 ký tự (`MAX_TEXT_LENGTH`) — không được bỏ.** Regex parser chạy đồng bộ
và có độ phức tạp phi tuyến với input dài (đo thật: 203KB = 8.665ms trước khi neo regex SHB).
Thông báo ngân hàng thật < 500 ký tự. Khi viết parser mới: **không dùng `.*?` / `.+?` không neo**,
dùng `[^\n]{0,N}?` để chặn backtracking.

Secret so sánh bằng hash SHA-256 + XOR toàn bộ (constant-time), không dùng `!==`.
Response **không** trả `raw_text` về client.
Test: `docker run --rm -v "$PWD/supabase/functions/parse-transaction:/app" -w /app denoland/deno:2.1.4 test --allow-all` (mọi file test)

---

## Edge Function `admin` (`supabase/functions/admin/`)

Cổng duy nhất cho quản trị. `admin-auth.ts`: `getUser(token)` → `app_metadata.role === 'admin'` (user không tự ghi được
app_metadata) → claim `aal === 'aal2'` (MFA TOTP) — sai thì 401/403 `forbidden`/`mfa_required`. `admin-actions.ts`: danh sách
hành động ĐÓNG `list_users`, `get_user`, `suspend`, `unsuspend`, `revoke_keys`, `list_audit`; lý do 5..500 ký tự; không nhắm
chính mình / admin khác. Email + đăng nhập cuối + ban lấy từ GoTrue (`auth.admin.listUsers`), ghép theo id với
`admin_user_stats` — RPC không đọc `auth.users`. Khoá = RPC (cờ DB + audit) TRƯỚC, rồi ban GoTrue (`ban_duration`);
ban lỗi → `502 ban_failed`, bấm lại an toàn. `get_user` ghi audit `view_user` TRƯỚC khi trả dữ liệu (ghi lỗi → không trả).
Đường legacy `x-shortcut-secret` cũng kiểm khoá của `DEFAULT_USER_ID` (không kiểm được → 500, không cho qua).
Gán admin (SQL, 1 lần): `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '…'`.
Break-glass gỡ ban: `update auth.users set banned_until = null where id = '…'` + `update user_settings set suspended_at = null …`.
Break-glass mất điện thoại TOTP: `delete from auth.mfa_factors where user_id = '<admin id>'` rồi đăng nhập lại và enroll lại.
TOTP: `config.toml` `[auth.mfa.totp]` chỉ cho local — **production bật ở dashboard** (Authentication → Multi-Factor).
Test: `docker run --rm -v "$PWD/supabase/functions:/f" -w /f/parse-transaction denoland/deno:2.1.4 test --allow-all . ../admin`
