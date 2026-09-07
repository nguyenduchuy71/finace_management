import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
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
})
