#!/usr/bin/env bash
#
# Đọc các thông báo CHƯA parse được từ bảng `unparsed_messages`.
#
# Đây là nguồn dữ liệu DUY NHẤT để viết parser cho bank mới: nội dung thông báo
# app không công khai ở đâu (đã search, không có), chỉ xuất hiện trên máy bạn.
#
# Quy trình thêm parser cho 1 bank:
#   1. Bật thông báo app của bank đó, cấu hình Shortcut gửi về edge function
#   2. Thực hiện 1 giao dịch nhỏ
#   3. Chạy script này -> copy raw_text nguyên văn
#   4. Thêm 1 case vào parsers.test.ts với text đó
#   5. Viết parser trong parsers.ts cho tới khi test xanh
#   6. Đánh dấu resolved: ./inspect-unparsed.sh --resolve <id>
#
# Dùng:
#   ./inspect-unparsed.sh              # liệt kê thông báo chưa xử lý
#   ./inspect-unparsed.sh --all        # kể cả đã resolved
#   ./inspect-unparsed.sh --resolve ID # đánh dấu đã viết parser xong

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { echo "LỖI: không tìm thấy .env ở $ROOT"; exit 1; }
set -a; source .env; set +a

URL="${VITE_SUPABASE_URL:?thiếu VITE_SUPABASE_URL}"
# Bảng unparsed_messages bật RLS nhưng KHÔNG có policy nào -> chỉ service_role đọc được.
KEY="${SUPABASE_SERVICE_ROLE_KEY:?thiếu SUPABASE_SERVICE_ROLE_KEY}"

if [[ "${1:-}" == "--resolve" ]]; then
  ID="${2:?cần id, xem bằng cách chạy không tham số}"
  # Validate UUID: $ID ghép vào URL của request chạy bằng service_role (bypass RLS)
  # và không được URL-encode -> giá trị crafted chèn thêm query param, PATCH nhầm row.
  if [[ ! "$ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "LỖI: id không phải UUID hợp lệ: '$ID'"
    exit 1
  fi
  curl -sf -X PATCH "$URL/rest/v1/unparsed_messages?id=eq.$ID" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d '{"resolved":true}' >/dev/null
  echo "Đã đánh dấu resolved: $ID"
  exit 0
fi

FILTER="resolved=eq.false"
[[ "${1:-}" == "--all" ]] && FILTER=""

curl -sf "$URL/rest/v1/unparsed_messages?select=id,raw_text,received_at,resolved,source,reason&${FILTER}&order=received_at.desc&limit=50" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
| python3 -c '
import json, sys
rows = json.load(sys.stdin)
if not rows:
    print("Không có thông báo nào chưa parse được.")
    print()
    print("Nếu bạn VỪA giao dịch mà không thấy gì, kiểm tra:")
    print("  - Shortcut đã gửi request tới edge function chưa?")
    print("  - Header x-shortcut-secret đúng chưa? (thiếu -> 401, không lưu gì)")
    print("  - Edge function đã deploy bản mới nhất chưa?")
    sys.exit(0)

print(f"{len(rows)} thông báo chưa parse được:\n")
for r in rows:
    flag = " [resolved]" if r.get("resolved") else ""
    rid, ts = r["id"], r["received_at"][:19]
    meta = f"  source={r.get('source') or '?'}  reason={r.get('reason') or '?'}"
    print(f"--- id={rid}  {ts}{meta}{flag}")
    print(r["raw_text"])
    print()
print("Copy nguyên văn phần trên vào parsers.test.ts rồi viết parser.")
'
