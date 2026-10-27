# Thu giao dịch ngân hàng bằng iOS Shortcuts

Mọi thông báo giao dịch (app ngân hàng, SMS, email) → Shortcut → edge function
`parse-transaction` → bảng `transactions`.

```
Thông báo app (iOS 27+) ─┐
SMS (trigger Message)    ├─► Automation (1 cái / bank) ─► Shortcut "FM Gửi giao dịch"
Email (trigger Email)    ┘        gắn source="<bank>"        POST {text, source}
                                                                    │
     edge function: NFC → OTP? → trùng 10 phút? → 19 regex parser → (không khớp / chưa có TK) unparsed_messages
```

| Kênh | Trigger trong Shortcuts | Dùng khi |
|---|---|---|
| Thông báo app (OTT) | **Notification** — "When I receive a notification from [app]" (iOS 27+) | Bank đã chuyển biến động số dư sang app (đa số bank hiện nay) |
| SMS | **Message** — "Message contains …" | Bank vẫn gửi SMS Banking |
| Email | **Email** — sender/subject | Bank chỉ gửi email (thường là thẻ tín dụng, bank nước ngoài) |

**Mỗi bank chỉ bật MỘT kênh.** Chống trùng chỉ bắt được cùng một thông báo bị
gửi lặp; cùng giao dịch về qua cả SMS lẫn app (nội dung khác nhau) sẽ bị ghi 2 lần.

---

## 1. Deploy backend (làm 1 lần)

```bash
npx supabase db push
npx supabase functions deploy parse-transaction
npx supabase functions deploy delete-account
```

Mỗi user tự tạo **API key** ở trang **Cài đặt** của web (`vj_…`, chỉ hiện một lần; DB chỉ giữ
SHA-256). Mỗi iPhone/Shortcut nên dùng một key riêng để thu hồi riêng khi mất máy. Key thu hồi
bị từ chối ngay request kế. Giới hạn: 10 key còn hiệu lực/user, 60 request/phút/key.

**Không dùng anon key** làm key cho Shortcut (anon key nằm trong bundle JS, ai mở web cũng đọc được).

Kiểm tra: không header → `401`; key đúng + `{"text":"ping"}` → `200 no_match`.

> **Legacy (gỡ ở phase 4 của plan SaaS):** header `x-shortcut-secret` + secret `SHORTCUT_SECRET`
> và `DEFAULT_USER_ID` vẫn được nhận để Shortcut cũ không gãy. Chỉ chạy khi đặt CẢ hai secret.
> Shortcut mới dùng `Authorization: Bearer <key>`.

## 2. Khai báo tài khoản/thẻ trong DB

Giao dịch chỉ hiện trong danh sách khi gắn được vào `accounts`/`credit_cards`:

- `bank_name` phải **trùng chính xác** với tên parser đặt (`LPBank`, `SHB`, `HDBank`, `MSB`,
  `VPBank`, `WOORIVN`, `UOB`, `Sacombank`, `MoMo`, `BIDV`, `OCB`, `Vietinbank`, `Cake`).
- `account_number`/`card_number` phải **kết thúc bằng 4 ký tự cuối** in trong thông báo
  (vd thông báo ghi `4074***2789` → số thẻ lưu kết thúc bằng `2789`).

Sai một trong hai → giao dịch vẫn vào dashboard nhưng không hiện trong danh sách
(xem `getUnlinkedCount()`).

## 3. Tạo Shortcut dùng chung "FM Gửi giao dịch"

Shortcuts → tab **Shortcuts** → **+**. Đặt tên `FM Gửi giao dịch`.
Trong ⓘ → bật **Receive input** từ *Dictionary*.

Actions:

1. **Get Dictionary from Input** (Shortcut Input)
2. **Get Contents of URL**
   - URL: `https://paiqxoewrgjtmaotfajg.supabase.co/functions/v1/parse-transaction`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer vj_…` (key tạo ở trang Cài đặt)
   - Request Body: **JSON**
     - `text` (Text) = *Dictionary* → Get Value for `text`
     - `source` (Text) = *Dictionary* → Get Value for `source`

Key chỉ nằm ở shortcut này; đổi key (thu hồi + tạo mới) thì chỉ sửa một chỗ.

Response để debug: `201 {inserted}` (đã ghi), `200 {skipped: duplicate | no_match | otp_or_security}`,
`422 invalid_parse` (regex khớp nhưng ra số/ngày vô nghĩa), `401` key sai/đã thu hồi, `429` quá 60 request/phút,
`413` nội dung quá dài.

## 4. Mỗi bank một Automation

Shortcuts → **Automation** → **+**.

### 4a. Thông báo app (iOS 27+)

1. Chọn **Notification** → **App**: chọn app ngân hàng (vd *VCB Digibank*).
   **Không** thêm bộ lọc tiêu đề/nội dung — có báo cáo từ bản beta là bộ lọc làm trigger
   không chạy. Tin quảng cáo sẽ vào `unparsed_messages` (`no_match`), không thành giao dịch.
2. Chọn **Run Immediately**, tắt **Notify When Run**.
3. Actions:
   1. **Text**: chèn biến *Shortcut Input* → chọn **Title**, xuống dòng, *Shortcut Input* → **Body**
   2. **Dictionary**: `text` = biến *Text* ở trên; `source` = `OCB` (gõ cứng tên bank — chỉ để biết tin lạ đến từ app nào)
   3. **Run Shortcut** `FM Gửi giao dịch`, input = *Dictionary*

Ghép Title + Body vì một số bank để tên bank/loại giao dịch ở tiêu đề.

### 4b. SMS

1. **Message** → **Message Contains**: một chuỗi luôn có trong SMS của bank đó
   (vd `SD:` hoặc tên brandname). **Sender**: chọn brandname nếu iOS cho chọn.
2. **Run Immediately**.
3. Actions như 4a nhưng *Text* = *Shortcut Input* → **Content**.

### 4c. Email

1. **Email** → **Sender** = địa chỉ email thông báo của bank, **Subject Contains** (tuỳ chọn).
2. **Run Immediately**. Chỉ hoạt động với app **Mail** của Apple.
3. Actions như 4a, *Text* = *Shortcut Input* → **Body**.
   Email dài hơn 2000 ký tự bị từ chối (`413`) — dùng **Subject Contains** để chỉ bắt email ngắn.

## 5. Kiểm tra từng bank (bắt buộc với bank mới)

1. Làm 1 giao dịch nhỏ (vd chuyển 1.000đ).
2. Mở Shortcuts → Automation → xem lần chạy gần nhất có lỗi không.
3. Đối chiếu trong Supabase SQL editor:

```sql
-- Giao dịch vừa ghi: soát số tiền, dấu +/-, ngày, đã gắn thẻ/TK chưa
select bank_name, amount, transaction_date, description, account_id, card_id
from transactions order by created_at desc limit 20;

-- Tin bị loại và lý do
select source, reason, received_at, raw_text
from unparsed_messages where not resolved order by received_at desc;
```

Hoặc chạy `supabase/functions/parse-transaction/inspect-unparsed.sh`, hoặc xem tab
**Giao dịch ngân hàng → Chưa phân loại** trên web.

> ⚠️ **Luôn gắn `source`** trong Dictionary của mọi automation. Đo 21/10/2026: 100% tin trong
> `unparsed_messages` có `source = null`, nên vài định dạng (tài khoản `800xx0300`, "Thông báo ghi có
> Tài khoản **0265", "Số dư tài khoản của bạn vừa tăng") **không biết là bank nào** và chưa viết
> parser được (`bank_name` sai thì giao dịch không gắn được tài khoản).

### OCB (push app OCB OMNI)

OCB không gửi SMS thẻ tín dụng nữa → tạo automation trigger **Notification** của app OCB OMNI, `source: "OCB"`.
Parser phủ mẫu "Thông báo biến động số dư" của **tài khoản** (`Tài khoản: …`) và **thẻ tín dụng** (`Thẻ tín dụng: 35-9586`).
Thẻ/TK trong DB: `bank_name = OCB`, số kết thúc đúng 4 số cuối (vd thẻ `****9586`, TK `****0265`).
Dấu +/- là bắt buộc: thiếu dấu thì không đoán, tin vào hộp "Chưa phân loại".

## 6. Tin chưa đọc được

Tin không khớp parser vào `unparsed_messages` kèm `suggested_kind` (giao dịch / nhắc thẻ /
quảng cáo / chưa rõ). User xử lý ở tab **Chưa phân loại**: ghi thành giao dịch (chọn TK/thẻ,
loại chi-thu thường / chuyển nội bộ / cashback) hoặc đánh dấu nhắc thẻ / quảng cáo.

Đã có parser push "biến động số dư": BIDV (SmartBanking), Vietinbank, OCB (TK + thẻ tín dụng),
SHB SAHA, HDBank (TK), Cake (thẻ tín dụng), Sacombank Pay (trả nợ thẻ) —
`parsers-balance-notifications.ts`. Chưa có: ACB, VIB, HSBC, Eximbank, KBank, BaoVietBank,
ShinhanBank. Viết parser mới: copy `raw_text` thật vào test, viết regex (hướng dẫn cuối
`parsers.ts`), deploy lại. **Không viết regex theo phỏng đoán** — sai thì bóc nhầm số tiền.
Sau khi deploy parser mới, chạy `backfill-unparsed.ts` (dry-run trước) để ghi lại các tin cũ.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Automation không chạy | Chưa bật thông báo của app trong Settings → Notifications; hoặc đã thêm bộ lọc tiêu đề/nội dung |
| `401` | Header `Authorization: Bearer <key>` thiếu, sai, hoặc key đã thu hồi (trang Cài đặt hiện trạng thái key) |
| `429` | Quá 60 request/phút với cùng một key — automation đang chạy lặp |
| `no_match` với bank đã có parser | Thông báo ẩn nội dung ("Bạn có 1 thông báo mới") — bật hiển thị nội dung trong app ngân hàng; hoặc bank đổi định dạng — so `raw_text` với mẫu trong `parsers.test.ts` |
| Có trong dashboard, không có trong danh sách | `bank_name` trong DB khác tên parser, hoặc số thẻ/TK không kết thúc bằng 4 ký tự trong thông báo |
| Ghi 2 lần | Bank bật cả SMS và app cùng lúc — tắt automation của một kênh |
| Tin có dấu tiếng Việt không khớp parser dù nhìn giống mẫu | iOS gửi Unicode NFD; edge function đã chuẩn hoá NFC (`normalizeInput`) — test thủ công bằng `try-parse.ts` (cũng chuẩn hoá) |
| Trả nợ thẻ từ TK ngân hàng tính là chi; chuyển giữa TK của mình hiện ở cả thu lẫn chi | **Chưa khai báo tên chủ tài khoản.** Nhập ở trang **Cài đặt → Nhận diện chuyển khoản nội bộ** (có dấu hay không đều được, mỗi dòng một tên). Đường legacy vẫn đọc secret `OWNER_NAMES`. Giao dịch cũ: sửa tay hoặc ghi lại qua hộp tin |
| Trả nợ thẻ / chuyển giữa TK của mình làm phồng thu-chi | Giao dịch phải là `kind = internal_transfer`. Tự gắn khi nội dung có "THANH TOAN THE TIN DUNG", hoặc tên chủ TK (trang Cài đặt; legacy: secret `OWNER_NAMES`) là người gửi (tiền vào) / người nhận (tiền ra) |
