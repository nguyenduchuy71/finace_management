import { beforeAll } from 'vitest'
import { supabase } from '@/lib/supabase'

/**
 * Setup cho test integration — chạy trên Supabase LOCAL.
 *
 * ⚠️  KHÔNG BAO GIỜ trỏ VITE_SUPABASE_URL sang project production khi chạy
 *     test integration: `supabase db reset` sẽ xoá sạch data thật.
 */
export const TEST_USER = {
  email: 'test@local.dev',
  password: 'testpassword123',
}

beforeAll(async () => {
  const url = import.meta.env.VITE_SUPABASE_URL ?? ''
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error(
      `Test integration chỉ được chạy trên Supabase LOCAL, nhưng đang trỏ tới:\n` +
        `  ${url}\n\n` +
        `Test sẽ ghi/xoá dữ liệu — chạy trên production là MẤT DỮ LIỆU THẬT.\n\n` +
        `Nguyên nhân thường gặp: thứ tự ưu tiên env của Vite ở mode test là\n` +
        `  .env < .env.test < .env.local < .env.test.local\n` +
        `nên .env.local (trỏ remote) sẽ ĐÈ .env.test.\n\n` +
        `Cách sửa: tạo .env.test.local trỏ về local (ưu tiên cao nhất):\n` +
        `  cp .env.test .env.test.local`
    )
  }

  const { error } = await supabase.auth.signInWithPassword(TEST_USER)
  if (error) {
    throw new Error(
      `Không đăng nhập được test user. Supabase local đã chạy chưa?\n` +
        `  supabase start && supabase db reset\n` +
        `Lỗi gốc: ${error.message}`
    )
  }
})
