import { createClient } from '@supabase/supabase-js'

/**
 * Client service_role của Supabase LOCAL cho test integration (VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local, lấy từ
 * `supabase status -o env`; integration-setup.ts đã chặn URL không phải local). Dùng để seed dữ liệu mà client thường
 * không còn quyền ghi — vd INSERT transactions (chỉ RPC trừ credit / service_role ghi được).
 */
export function createServiceClient() {
  const serviceKey = import.meta.env.VITE_TEST_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) {
    throw new Error('Thiếu VITE_TEST_SERVICE_ROLE_KEY trong .env.test.local (SERVICE_ROLE_KEY của `supabase status -o env`).')
  }
  return createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
