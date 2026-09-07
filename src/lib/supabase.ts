import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example sang .env.local'
  )
}

/**
 * Supabase client dùng chung.
 *
 * anon key nằm trong bundle JS của browser (ai cũng đọc được) — RLS ở DB là lớp
 * bảo vệ duy nhất.
 *
 * Quy ước: mọi truy cập DATA (.from/.rpc) phải đi qua src/services/*, component
 * không gọi trực tiếp. Riêng supabase.auth.* (login/logout/session) được dùng
 * thẳng trong features/auth/ và AppHeader vì đó là auth, không phải data.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
