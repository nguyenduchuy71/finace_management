// supabase/functions/parse-transaction/index.ts
//
// Nhận text thô từ Shortcuts, tự nhận diện ngân hàng, bóc tách dữ liệu,
// resolve thẻ/tài khoản, và insert vào bảng `transactions`.
//
// Deploy: supabase functions deploy parse-transaction
// Gọi từ Shortcuts: POST { "text": "<nội dung notification>", "source": "<tên bank>" }
//   header: Authorization: Bearer vj_… (API key của user, tạo ở trang Cài đặt).
//   Legacy x-shortcut-secret (single-tenant) còn nhận tới phase 4. `source` tuỳ chọn —
//   xem docs/ios-shortcut-setup.md
//
// Luồng: xác thực key -> OTP? -> trùng? -> regex parser -> (không khớp) unparsed_messages + gợi ý loại

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseOwnerNames } from './internal-transfer.ts'
import { createHandler } from './handler.ts'
import { createIngestStore } from './persist.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Shortcut trên iOS không cầm được JWT của user -> API key riêng của từng user.
// Rate limit đếm ở Postgres (authenticate_api_key), không đếm trong bộ nhớ: edge
// function chạy nhiều instance ngắn hạn, mỗi instance đếm riêng, restart là mất.
//
// LEGACY single-tenant (gỡ ở phase 4): secret chung -> mọi giao dịch thuộc
// DEFAULT_USER_ID, tên chủ TK (phân tách ";") lấy từ env OWNER_NAMES. Chỉ chạy khi
// có cả SHORTCUT_SECRET và DEFAULT_USER_ID. User qua API key dùng
// user_settings.owner_names thay cho env này.
const LEGACY = {
  secret: Deno.env.get('SHORTCUT_SECRET'),
  userId: Deno.env.get('DEFAULT_USER_ID'),
  ownerNames: parseOwnerNames(Deno.env.get('OWNER_NAMES')),
  async isSuspended(userId: string) {
    const { data, error } = await supabase
      .from('user_settings').select('suspended_at').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data?.suspended_at != null
  },
}

serve(createHandler({
  // Bao RPC authenticate_api_key (chỉ service role gọi được) cho resolveCaller.
  authenticate: (keyHashHex) => supabase.rpc('authenticate_api_key', { p_key_hash: keyHashHex }),
  legacy: LEGACY,
  store: createIngestStore(supabase),
}))
