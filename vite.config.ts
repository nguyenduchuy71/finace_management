import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { assertLegalEnv } from './src/config/legal-env-guard'

/**
 * Chặn build production thiếu URL Supabase hợp lệ. Thiếu thì app trắng trang ngay khi mở
 * ("Invalid supabaseUrl") — từng xảy ra khi build trên CI với biến Sensitive của Vercel bị thay
 * bằng "[SENSITIVE]". Fail ở đây để bản hỏng không bao giờ được deploy.
 */
function assertSupabaseUrl(mode: string) {
  const url = process.env.VITE_SUPABASE_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL
  let ok = false
  try { ok = ['http:', 'https:'].includes(new URL(url ?? '').protocol) } catch { ok = false }
  if (!ok) throw new Error(`VITE_SUPABASE_URL không hợp lệ cho build "${mode}": ${JSON.stringify(url ?? null)}`)
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    assertSupabaseUrl(mode)
    // Chỉ chặn trên Vercel production (VERCEL_ENV); build local / CI verify không đặt biến này nên vẫn qua.
    assertLegalEnv(process.env.VERCEL_ENV, { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env })
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            anthropic: ['@anthropic-ai/sdk'],
            markdown: ['react-markdown'],
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
      chunkSizeWarningLimit: 1000,
      // esbuild is Vite's default — fast and effective tree-shaking; terser not installed
    },
    test: {
      // Tách 2 project: `unit` chạy không cần docker (mặc định của `npm test`),
      // `integration` cần `supabase start` nên chậm hơn nhiều.
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test-setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: ['node_modules', 'dist', 'src/**/*.integration.test.{ts,tsx}'],
            // Giá trị giả BẮT BUỘC phải có: `src/lib/supabase.ts` throw ngay lúc
            // import nếu thiếu 2 biến này, nên mọi test import service (dù đã
            // vi.mock service đó) đều chết ở khâu nạp module.
            //
            // Máy dev có .env nên không lộ; CI không có -> đỏ. Đặt ở đây để unit
            // test KHÔNG phụ thuộc file .env bên ngoài (chạy giống nhau ở mọi nơi).
            // URL không có thật và unit test không gọi mạng — service đều bị mock.
            env: {
              VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
              VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
            },
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test-setup.ts', './src/test/integration-setup.ts'],
            include: ['src/**/*.integration.test.{ts,tsx}'],
            exclude: ['node_modules', 'dist'],
            testTimeout: 30_000,
            // Test integration dùng chung 1 DB -> chạy tuần tự tránh đụng state
            fileParallelism: false,
          },
        },
      ],
    },
  }
})
