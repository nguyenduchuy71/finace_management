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

**RLS chéo 2 user** (integration chỉ có 1 test user): `supabase/tests/card-crud-rls.sql`, `card-cashback-tiers-rls.sql`, `unparsed-accounts-rls.sql`,
`api-keys-rls.sql`, `admin-rls.sql`, `credit-ledger-rls.sql` chạy trên Postgres 17 tạm
(`docker run postgres:17-alpine` + `scratch-stub.sql` giả `auth.uid()`), hướng dẫn ở đầu file. Không chạy trên stack Supabase đang dùng.
`credit-concurrency.sql` cần nhiều session `psql` thật chạy song song (3 giai đoạn, lệnh ở đầu file): `FOR UPDATE` của `ingest_transaction` —
bỏ nó (hoặc bỏ kiểm số dư) là test đỏ. Trong file SQL, subquery cùng câu SELECT với lời gọi hàm ghi chỉ thấy dữ liệu TRƯỚC khi ghi:
đọc trạng thái sau hành động bằng câu lệnh riêng hoặc hàm plpgsql (`t.cnt`, `t.bal`).
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
- Install: `npm ci`; Build: `tsc -b && vite build` → `dist/`; Region: `sfo1`
- Env: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` đặt trong Vercel dashboard. Job deploy dùng `vercel deploy`
  (**build trên Vercel**), KHÔNG `vercel pull` + `--prebuilt`: biến loại Sensitive không kéo về được (`vercel pull` ghi
  `"[SENSITIVE]"`), build trên runner đóng gói chuỗi đó làm URL → production trắng trang "Invalid supabaseUrl" (2026-10-21).
  `vite.config.ts` làm `vite build` FAIL khi `VITE_SUPABASE_URL` không phải URL http(s) hợp lệ.
