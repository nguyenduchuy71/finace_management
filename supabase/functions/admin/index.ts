// supabase/functions/admin/index.ts
//
// Cổng DUY NHẤT cho thao tác quản trị. RLS các bảng không có policy "admin bypass": function
// dùng service role, nhưng chỉ sau khi xác nhận người gọi là admin + đã qua MFA (aal2), và chỉ
// chạy các hành động trong admin-actions.ts. Mọi thay đổi ghi admin_audit_log trong RPC.
//
// Deploy: supabase functions deploy admin   (verify_jwt bật)
// Gọi từ app: supabase.functions.invoke('admin', { body: { action, ... } })
// Gán quyền admin (1 lần, SQL): update auth.users set raw_app_meta_data =
//   raw_app_meta_data || '{"role":"admin"}' where email = '...';

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, requireAdmin } from './admin-auth.ts'
import { handleAction, type AdminDeps, type AuthUser } from './admin-actions.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// '*' như delete-account: xác thực bằng Bearer JWT, không cookie.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** ~100 năm: "khoá vô thời hạn" theo cách GoTrue biểu diễn. */
const BAN_FOREVER = '876000h'
/** < 200 user: vài trang là hết; trần để vòng lặp không chạy mãi nếu GoTrue trả sai. */
const PAGE_SIZE = 1000
const MAX_PAGES = 20
/** Body hợp lệ chỉ vài chục byte (action + id + lý do ≤ 500 ký tự). */
const MAX_BODY_LENGTH = 4_000

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const deps: AdminDeps = {
  async listAuthUsers() {
    const all: AuthUser[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
      if (error) throw error
      all.push(...(data.users as AuthUser[]))
      if (data.users.length < PAGE_SIZE) return all
    }
    // Không cắt cụt im lặng (CLAUDE.md): danh sách thiếu user là danh sách sai.
    throw new Error(`listUsers vượt ${MAX_PAGES * PAGE_SIZE} user`)
  },
  async getAuthUser(id) {
    const { data, error } = await supabase.auth.admin.getUserById(id)
    // Chỉ 404 mới là "không có user"; lỗi khác (GoTrue chập chờn) mà coi là không có thì admin
    // tưởng user đã bị xoá -> throw, handler trả 500.
    if (error) {
      if (error.status === 404) return null
      throw error
    }
    return (data.user as AuthUser) ?? null
  },
  async setBan(id, banned) {
    const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: banned ? BAN_FOREVER : 'none' })
    if (error) throw error
  },
  rpc: (fn, params) => supabase.rpc(fn, params),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const auth = await requireAdmin(bearerToken(req.headers), (t) => supabase.auth.getUser(t))
    if (!auth.ok) return json({ error: auth.error }, auth.status)

    const raw = await req.text()
    if (raw.length > MAX_BODY_LENGTH) return json({ error: 'body too large' }, 413)
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: 'invalid json' }, 400)
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return json({ error: 'invalid body' }, 400)
    }

    const result = await handleAction(deps, auth.adminId, body as Record<string, unknown>)
    return json(result.body, result.status)
  } catch (e) {
    // Chi tiết chỉ vào log, không trả cho client.
    console.error('admin failed', String(e))
    return json({ error: 'internal error' }, 500)
  }
})
