# Thu giao dịch ngân hàng bằng iOS Shortcuts

Mọi thông báo giao dịch (app ngân hàng, SMS, email) → Shortcut → edge function
`parse-transaction` → bảng `transactions`.

```
Thông báo app (iOS 27+) ─┐
SMS (trigger Message)    ├─► Automation (1 cái / bank) ─► Shortcut "FM Gửi giao dịch"
Email (trigger Email)    ┘        gắn source="<bank>"        POST {text, source}
                                                                    │
     edge function: OTP? → trùng 10 phút? → 12 regex parser → (không khớp) unparsed_messages
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
S=$(openssl rand -hex 32) && printf 'SHORTCUT_SECRET=%s\n' "$S" > .env.deploy && chmod 600 .env.deploy
npx supabase secrets set SHORTCUT_SECRET="$S" DEFAULT_USER_ID=<auth.users.id của bạn>
npx supabase functions deploy parse-transaction
```

`SHORTCUT_SECRET` phải là chuỗi ngẫu nhiên riêng — **không dùng anon key** (anon key
nằm trong bundle JS, ai mở web cũng đọc được, rồi POST giao dịch giả vào DB của bạn).
`.env.deploy` đã bị `.gitignore` chặn.

Kiểm tra: không header → `401`; đúng secret + `{"text":"ping"}` → `200 no_match`.

## 2. Khai báo tài khoản/thẻ trong DB

Giao dịch chỉ hiện trong danh sách khi gắn được vào `accounts`/`credit_cards`:

- `bank_name` phải **trùng chính xác** với tên parser đặt (`LPBank`, `SHB`, `HDBank`, `MSB`,
  `VPBank`, `WOORIVN`, `UOB`, `Sacombank`, `MoMo`, `BIDV`, `OCB`).
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
   - Headers: `x-shortcut-secret` = giá trị trong `.env.deploy`
   - Request Body: **JSON**
     - `text` (Text) = *Dictionary* → Get Value for `text`
     - `source` (Text) = *Dictionary* → Get Value for `source`

Secret chỉ nằm ở shortcut này; đổi secret thì chỉ sửa một chỗ.

Response để debug: `201 {inserted}` (đã ghi), `200 {skipped: duplicate | no_match | otp_or_security}`,
`422 invalid_parse` (regex khớp nhưng ra số/ngày vô nghĩa), `401` sai secret.

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

Hoặc chạy `supabase/functions/parse-transaction/inspect-unparsed.sh`.

### OCB (push app OCB OMNI)

OCB không gửi SMS thẻ tín dụng nữa → tạo automation trigger **Notification** của app OCB OMNI, `source: "OCB"`.
Parser hiện chỉ phủ mẫu **trả nợ thẻ** ("Thông báo biến động số dư … Thẻ tín dụng: 35-9586 Số tiền: +100,000 VND …").
Thẻ trong DB: `bank_name = OCB`, `card_number` kết thúc đúng 4 số cuối (vd `****9586`). Tin chi tiêu OCB có định dạng
khác sẽ vào `unparsed_messages` — lấy mẫu thật rồi thêm parser.

## 6. Bank chưa có parser

ACB, VIB, HSBC, Eximbank, Cake, KBank, Vietinbank, BaoVietBank, ShinhanBank:
thông báo vào `unparsed_messages` (`reason = no_match`, `source` = tên bank). Copy
`raw_text` thật vào `parsers.test.ts`, viết parser trong `parsers.ts` (hướng dẫn ở
cuối file), deploy lại. **Không viết regex theo phỏng đoán** — sai thì bóc nhầm số tiền.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Automation không chạy | Chưa bật thông báo của app trong Settings → Notifications; hoặc đã thêm bộ lọc tiêu đề/nội dung |
| `401` | Header `x-shortcut-secret` sai |
| `no_match` với bank đã có parser | Thông báo ẩn nội dung ("Bạn có 1 thông báo mới") — bật hiển thị nội dung trong app ngân hàng; hoặc bank đổi định dạng — so `raw_text` với mẫu trong `parsers.test.ts` |
| Có trong dashboard, không có trong danh sách | `bank_name` trong DB khác tên parser, hoặc số thẻ/TK không kết thúc bằng 4 ký tự trong thông báo |
| Ghi 2 lần | Bank bật cả SMS và app cùng lúc — tắt automation của một kênh |
