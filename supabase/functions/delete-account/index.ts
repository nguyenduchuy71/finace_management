// supabase/functions/delete-account/index.ts
//
// Xoá TÀI KHOẢN của chính user đang đăng nhập (quyền xoá dữ liệu cá nhân).
// Client không xoá được auth.users -> function dùng service role, nhưng CHỈ xoá
// đúng user sở hữu JWT gửi lên. Mọi bảng có user_id `on delete cascade` nên xoá
// auth.users là xoá hết giao dịch, TK, thẻ, rule, hộp tin, API key, cài đặt.
//
// Deploy: supabase functions deploy delete-account   (verify_jwt bật: gateway chặn JWT sai trước)
// Gọi từ app: supabase.functions.invoke('delete-account', { method: 'POST' })

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, CORS_HEADERS as CORS, jsonResponse } from '../_shared/http.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const json = (body: unknown, status: number) => jsonResponse(body, status, CORS)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const token = bearerToken(req.headers)
    if (!token) return json({ error: 'unauthorized' }, 401)

    // Lấy user TỪ token (GoTrue kiểm chữ ký + hạn), không nhận user id từ body.
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)

    const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id)
    if (delErr) {
      console.error('deleteUser failed', delErr.message)
      return json({ error: 'delete failed' }, 500)
    }
    return json({ deleted: true }, 200)
  } catch (e) {
    console.error('delete-account', String(e))
    return json({ error: 'internal_error' }, 500)
  }
})
