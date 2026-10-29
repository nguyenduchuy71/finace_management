<!-- Tách từ CLAUDE.md (import bằng @). Test và deploy. -->

## Testing

| Loại | File | Cần Docker |
|---|---|---|
| Unit | `src/**/*.test.{ts,tsx}` | Không |
| Integration | `src/**/*.integration.test.ts` | Có (`supabase start`) |
| Parser (Deno) | `supabase/functions/parse-transaction/parsers.test.ts` | Có |

Component test mock ở tầng service (`vi.mock('@/services/...')`), không chạm DB.
Integration test chạy trên Supabase local với `supabase/seeds/seed.sql` — số liệu cố định,
kỳ vọng ghi ở cuối file seed. `src/test/integration-setup.ts` chặn không cho trỏ vào
production (bảo vệ khỏi `db reset` xoá data thật).

**Chạy integration:** `.env`/`.env.local` trỏ remote nên guard sẽ chặn. Tạo `.env.test.local` (gitignored, ưu tiên cao
nhất) trỏ về local: `VITE_SUPABASE_URL=http://127.0.0.1:54321` + `VITE_SUPABASE_ANON_KEY` lấy từ `supabase status -o env`.
Cổng 54321/54322 phải trống (các stack Supabase của dự án khác dùng cùng cổng).

**Quy ước test:**
- Các file integration **dùng chung 1 DB** với `services.integration.test.ts` (assert tổng cố định theo seed) → mọi dữ liệu
  tạo ra phải dọn sạch, kể cả khi test fail (`afterAll` + dọn dữ liệu sót ở `beforeAll`; xoá thẻ bằng RPC `delete_credit_card`).
- Form dài: điền bằng `fireEvent.change`, **không** `userEvent.type` từng phím — chậm gấp chục lần khi cả bộ chạy song
  song và vượt timeout 5s.
- Component dùng hook thật cần 1 test **mount thật** (render loop từng lọt qua hàng trăm test xanh vì không test nào mount nó).
- Sau khi thêm test, **phá code có chủ đích** (mutation thủ công) để chắc test thật sự bắt được lỗi. **Sao lưu file trước** và khôi phục
  từ bản sao. **Không** `git checkout <file>` để khôi phục: nó xoá mất thay đổi chưa commit.
- **Test UI timeout trên máy đang tải cao** thường do tranh CPU khi vitest chạy song song mặc định. Chạy `--maxWorkers=6` để phân biệt
  timeout do tải với lỗi thật.

Integration hộp tin seed `unparsed_messages` bằng service_role **local**: thêm `VITE_TEST_SERVICE_ROLE_KEY` (SERVICE_ROLE_KEY của
`supabase status -o env`) vào `.env.test.local` — file chỉ nạp ở mode test, không vào bundle.

**Thanh toán:** `src/services/payments.integration.test.ts` (tạo đơn bằng service_role, fulfill, tự dọn); SQL: `supabase/tests/payment-orders-rls.sql`,
`payment-fulfill.sql` (3 giai đoạn seq/setup/assert, có tranh chấp nhiều session — hướng dẫn ở đầu file). Deno: `_shared/*.test.ts`.

**RLS chéo 2 user** (integration chỉ có 1 test user): `supabase/tests/card-crud-rls.sql`, `card-cashback-tiers-rls.sql`, `unparsed-accounts-rls.sql`,
`api-keys-rls.sql`, `admin-rls.sql`, `credit-ledger-rls.sql`, `credit-security-fixes.sql`, `payment-reconcile-cron.sql` (dựng stub `net`/`vault`) chạy trên Postgres 17 tạm
(`docker run postgres:17-alpine` + `scratch-stub.sql` giả `auth.uid()`), hướng dẫn ở đầu file. Không chạy trên stack Supabase đang dùng.
`payment-fulfill.sql` và `admin-orders.sql` (admin xử lý đơn: `mark_paid` cộng đúng 1 lần kể cả 4 session song song) cũng có giai đoạn song song (lệnh ở đầu file).
`credit-concurrency.sql` cần nhiều session `psql` thật chạy song song (3 giai đoạn, lệnh ở đầu file): `FOR UPDATE` của `ingest_transaction` —
bỏ nó (hoặc bỏ kiểm số dư) là test đỏ. Trong file SQL, subquery cùng câu SELECT với lời gọi hàm ghi chỉ thấy dữ liệu TRƯỚC khi ghi:
đọc trạng thái sau hành động bằng câu lệnh riêng hoặc hàm plpgsql (`t.cnt`, `t.bal`).
`scratch-stub.sql` cho `auth.users.email_confirmed_at` mặc định `now()` (user test coi như đã xác nhận email — nếu không sẽ không có credit chào mừng); ca chưa xác nhận
insert `email_confirmed_at = null` tường minh. `credit-security-fixes.sql` phủ C1 (insert giao dịch bị chặn), phân loại tính phí (trừ 1 / unlimited / hết credit / người khác / khoá),
credit chào mừng sau xác nhận email, replay bỏ dòng hỏng, thứ tự replay, admin cộng → replay, `discard_backfilled_tx`.
**Seed giao dịch trong integration test**: `authenticated` không INSERT được `transactions` → dùng `createServiceClient()` (`src/test/integration-admin.ts`); phân loại tin
dùng `resolveViaRpc` (`src/test/integration-resolve.ts`, RPC service_role vì local không `functions serve`) và hoàn credit đã trừ bằng `restoreCreditAfterTest`.
Integration credit (`credit-ledger.integration.test.ts`) tự chứa: đưa số dư test user về 1 rồi khôi phục (xoá dòng sổ cái do test tạo, tính lại `balance = sum(delta)`).

---

## Deployment (Vercel)

- **Chỉ deploy qua GitHub Actions, SAU khi CI xanh** (`.github/workflows/ci.yml`): job `verify` (lint, unit, build,
  Deno check + test parser) → job `deploy` (`needs: verify`) bằng Vercel CLI. Push `main` → production; PR → preview
  (bỏ qua PR từ fork). Git Integration của Vercel **tắt** (`"git": { "deploymentEnabled": false }` trong `vercel.json`)
  — bật lại là Vercel deploy song song, không chờ CI.
- GitHub secrets bắt buộc: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (`vercel link` → `.vercel/project.json`).
  Thiếu thì job deploy fail rõ ràng (không deploy gì).
- Integration test không chạy ở CI (cần stack Supabase + seed bị gitignore) → chạy local trước khi merge.
- **Migration `20261101100000` (sửa bảo mật credit): `supabase db push` rồi deploy NGAY** `supabase functions deploy resolve-unparsed`, `parse-transaction`
  (`--no-verify-jwt`), `admin`, và deploy web (Vercel qua CI) — web cũ gọi RPC `resolve_unparsed` đã bị DROP (hộp tin lỗi), `parse-transaction` cũ không map
  `no_account`, và không có function `resolve-unparsed` thì web mới không phân loại được. Production **phải bật email confirmations + SMTP** trước/cùng lúc (credit chào mừng
  giờ chỉ cấp sau xác nhận; user đã có đã được backfill từ migration trước).
- Deploy function thanh toán (thủ công, sau `db push`): `supabase functions deploy create-payment`;
  `supabase functions deploy payment-ipn-momo --no-verify-jwt`; `supabase functions deploy payment-ipn-zalopay --no-verify-jwt`;
  `supabase functions deploy payment-reconcile --no-verify-jwt` (+ `supabase secrets set` các biến thanh toán ở CLAUDE.md).
- Install: `npm ci`; Build: `tsc -b && vite build` → `dist/`; Region: `sfo1`
- Env: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` đặt trong Vercel dashboard. Job deploy dùng `vercel deploy`
  (**build trên Vercel**), KHÔNG `vercel pull` + `--prebuilt`: biến loại Sensitive không kéo về được (`vercel pull` ghi
  `"[SENSITIVE]"`), build trên runner đóng gói chuỗi đó làm URL → production trắng trang "Invalid supabaseUrl" (2026-10-21).
  `vite.config.ts` làm `vite build` FAIL khi `VITE_SUPABASE_URL` không phải URL http(s) hợp lệ.

---

## Checklist bật `enable_signup` (production) — chỉ tài liệu, làm tay

Production giữ `enable_signup = false` cho tới khi đủ TẤT CẢ:
1. Email confirmations bật + SMTP riêng (credit chào mừng chỉ cấp sau khi xác nhận email) + captcha production.
2. `credit_settings` / `credit_packages` đúng giá; ít nhất 1 ví (MoMo hoặc ZaloPay) có merchant production, `supabase secrets set` key
   production, `PAYMENT_ENV=production`, thử nạp thật gói nhỏ nhất.
3. Biến pháp lý đã đặt ở Vercel Production: `VITE_LEGAL_OPERATOR_NAME`, `VITE_LEGAL_CONTACT_EMAIL`, `VITE_DATA_REGION`
   (thiếu thì build production FAIL); đọc lại `/privacy`, `/terms` trên bản deploy, nên nhờ luật sư rà.
4. `pg_cron` + `pg_net` bật ở production; job `purge-raw-text` và `payment-reconcile` có trong `cron.job` (xem `database-schema.md` và mục dưới); `parse_rate_by_source` beta ≥ 90%.
5. Rồi mới bật signup (config Auth qua Management API, xem memory production-supabase-ops).

### Lịch đối soát thanh toán (Supabase Cron)

Migration `20261103100000_payment_reconcile_cron.sql`: job `payment-reconcile` (`*/5 * * * *`) chạy `select public.invoke_payment_reconcile()`,
hàm này đọc URL + secret từ **Vault lúc chạy** rồi `net.http_post` tới edge function `payment-reconcile` (header `x-reconcile-secret`).
Không secret nào nằm trong migration hay `cron.job.command`. Thiếu extension / vault / secret thì hàm trả `skipped:*` và không làm gì (không lỗi).
Local: migration tự đặt lịch (pg_cron/pg_net/vault có sẵn) nhưng chưa có secret nên job im lặng; xem `select public.invoke_payment_reconcile()` → `skipped:no_secret`.

Production (một lần):
1. Dashboard → Database → Extensions: bật `pg_cron` và `pg_net` (Vault đã bật sẵn).
2. `supabase secrets set RECONCILE_SECRET=<chuỗi ngẫu nhiên dài>` và `supabase functions deploy payment-reconcile --no-verify-jwt`.
3. SQL (Management API / SQL editor), hai secret **phải khớp**: `payment_reconcile_secret` = `RECONCILE_SECRET`:
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1/payment-reconcile', 'payment_reconcile_url');`
   `select vault.create_secret('<giá trị RECONCILE_SECRET>', 'payment_reconcile_secret');`
4. Nếu migration chạy khi chưa bật extension: chạy lại khối `do $cron$ … $cron$` ở cuối file (hoặc đúng dòng
   `select cron.schedule('payment-reconcile', '*/5 * * * *', 'select public.invoke_payment_reconcile()')`).
5. Kiểm: `select jobname, schedule from cron.job;` · `select * from cron.job_run_details order by start_time desc limit 5;` ·
   `select status_code, content from net._http_response order by id desc limit 5;` (mong 200). Đổi secret = `vault.update_secret`.
