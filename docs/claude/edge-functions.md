<!-- Tách từ CLAUDE.md (import bằng @). Edge function parse-transaction và admin. -->

## Edge Function (`supabase/functions/parse-transaction/`)

iOS Shortcut POST `{ "text": "<nội dung notification>", "source": "<bank_name>" }` + header
`Authorization: Bearer vj_…` (API key của user, `api-key-auth.ts` → RPC `authenticate_api_key`; Bearer có mặt thì KHÔNG rơi về
legacy). Legacy: `x-shortcut-secret` → `DEFAULT_USER_ID` (chỉ khi đặt cả 2 secret). Body > 16.000 ký tự → 413 trước `JSON.parse`.
`user_settings.owner_names` từ DB **phải** qua `normalizeOwnerNames` (bỏ dấu/in hoa/bỏ null) như env — mô tả giao dịch đã chuẩn hoá. Setup Shortcut (trigger Notification iOS 27 / Message / Email): `docs/ios-shortcut-setup.md`.
Cấu trúc: `index.ts` (nối dây) → `handler.ts` (pipeline, tiêm auth/DB) · `request.ts` (MAX_BODY_LENGTH 16000 / MAX_TEXT_LENGTH 2000, thuần) · `persist.ts` (chống trùng, ghi). HTTP dùng chung 3 function ở `supabase/functions/_shared/http.ts` (CORS, `jsonResponse`, `bearerToken`, `readJsonBody`).
Luồng: `normalizeInput` (**NFC** — iOS gửi NFD, regex NFC không khớp) → OTP → chống trùng (cùng `raw_text` trong 10 phút)
→ 19 regex parser → `withKind` (nhận diện chuyển nội bộ, `internal-transfer.ts`, tên chủ TK của user) → resolve TK/thẻ
(phải khớp DUY NHẤT) → `credit-ingest.ts` gọi RPC `ingest_transaction` (insert + trừ 1 credit NGUYÊN TỬ; **không còn `.from('transactions').insert` nào trong functions**);
**không khớp TK/thẻ thì KHÔNG ghi giao dịch mồ côi** mà vào hộp tin (`reason = no_account`, miễn phí);
hết credit → tin giữ (`reason = no_credit`, kèm `parsed_payload`) và trả **202 `{skipped:'no_credit'}`**; quá trần 300 tin treo → **402 `{error:'no_credit'}`** và tin không lưu;
chủ app `unlimited` không bị trừ/giữ (cả đường legacy `x-shortcut-secret`, vì cùng RPC);
chống trùng kiểm cả `transactions` lẫn `unparsed_messages`;
không khớp → `unparsed_messages` kèm `source`, `reason`, `user_id`, `suggested_kind` (`classify-unparsed.ts`, ưu tiên recall:
giao dịch thật không bao giờ bị gắn promo). `ingest.ts` (parse/resolve FK) + `credit-ingest.ts` (ghi + trừ credit) dùng chung với `backfill-unparsed.ts`
(chạy tay, dry-run mặc định; ghi qua cùng RPC nên cũng trừ credit, hết credit thì tin giữ nguyên trong hộp, xoá giao dịch do lostRace thì hoàn credit). Parser nhận `now` = thời điểm nhận tin cho tin không ghi ngày/năm.
Parser: LPBank (app + SMS), UOB, Sacombank, MoMo, BIDV (`parsers.ts`) + SHB, HDBank, MSB, VPBank, WOORIVN thẻ
(`parsers-card-sms.ts`) + BIDV push, Vietinbank, OCB TK/thẻ, SHB SAHA, HDBank TK, Cake thẻ, Sacombank Pay trả nợ
(`parsers-balance-notifications.ts`). Thứ tự mảng `parsers` quan trọng (khớp trước thắng).
**MoMo** (tin không có số TK, `account_ref: null`): `resolveRefs` gắn vào tài khoản `bank_name = 'MoMo'` của user nếu có ĐÚNG 1; 0 hoặc ≥ 2 thì vào hộp tin (`no_account`) — không đoán. Form TK chấp nhận mask bất kỳ 4 ký tự cho MoMo (vd 4 số cuối điện thoại). Secret check (legacy + webhook): `shortcut-auth.ts`.
**`OWNER_NAMES` hiện KHÔNG đặt trên production** (user quyết định; user nay tự nhập ở trang Cài đặt): BIDV trả nợ thẻ tính là chi, chuyển giữa TK của mình
đếm cả thu lẫn chi — chỉ "THANH TOAN THE TIN DUNG" và Sacombank Pay trả nợ được gắn nội bộ.
Bank xác định bằng đuôi thẻ/TK đối chiếu `credit_cards` — không đoán theo giọng văn.
Thứ tự deploy với migration 20261021100000: db push rồi deploy function ngay (function cũ không ghi user_id). Tương tự migration 20261030100000 (credit): `db push` rồi deploy `parse-transaction` + `admin` ngay — function cũ insert thẳng, không trừ credit; function mới chạy trên DB cũ thì thiếu RPC `ingest_transaction` (500, tin mất).

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
hành động ĐÓNG `list_users`, `get_user` (kèm 20 dòng sổ cái credit), `suspend`, `unsuspend`, `revoke_keys`, `adjust_credit` (`delta` nguyên ≠ 0, |delta| ≤ 1.000.000; RPC `admin_adjust_credit` ghi audit + sổ cái cùng transaction; trừ quá số dư → 400 `insufficient_credit`), `list_audit`; lý do 5..500 ký tự; không nhắm
chính mình / admin khác. Email + đăng nhập cuối + ban lấy từ GoTrue (`auth.admin.listUsers`), ghép theo id với
`admin_user_stats` — RPC không đọc `auth.users`. Khoá = RPC (cờ DB + audit) TRƯỚC, rồi ban GoTrue (`ban_duration`);
ban lỗi → `502 ban_failed`, bấm lại an toàn. `get_user` ghi audit `view_user` TRƯỚC khi trả dữ liệu (ghi lỗi → không trả).
Đường legacy `x-shortcut-secret` cũng kiểm khoá của `DEFAULT_USER_ID` (không kiểm được → 500, không cho qua).
Gán admin (SQL, 1 lần): `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '…'`.
Break-glass gỡ ban: `update auth.users set banned_until = null where id = '…'` + `update user_settings set suspended_at = null …`.
Break-glass mất điện thoại TOTP: `delete from auth.mfa_factors where user_id = '<admin id>'` rồi đăng nhập lại và enroll lại.
TOTP: `config.toml` `[auth.mfa.totp]` chỉ cho local — **production bật ở dashboard** (Authentication → Multi-Factor).
Test: `docker run --rm -v "$PWD/supabase/functions:/f" -w /f/parse-transaction denoland/deno:2.1.4 test --allow-all . ../admin` (`credit-ingest.ts` nằm trong danh sách `deno check` của CI)
