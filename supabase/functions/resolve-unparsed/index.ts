// supabase/functions/resolve-unparsed/index.ts
//
// Phân loại thủ công tin ở hộp "Chưa phân loại" — tạo giao dịch tốn 1 credit. Logic ở handler.ts.
// Deploy: supabase functions deploy resolve-unparsed   (verify_jwt bật; function còn tự getUser từ token)
// Gọi từ app: supabase.functions.invoke('resolve-unparsed', { body: { message_id, kind, tx } })

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken } from '../_shared/http.ts'
import { handleResolveUnparsed } from './handler.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

serve((req) => handleResolveUnparsed(req, {
  rpc: (fn, params) => db.rpc(fn, params),
  async authenticate(r) {
    const token = bearerToken(r.headers)
    if (!token) return null
    // User lấy TỪ token (GoTrue kiểm chữ ký + hạn), không nhận user id từ body.
    const { data, error } = await db.auth.getUser(token)
    return error || !data.user ? null : data.user.id
  },
}))
