import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui: mỗi file export component KÈM biến thể (`buttonVariants`, `badgeVariants`...) — đó là
    // cấu trúc chuẩn của thư viện, file sinh bởi `shadcn add`. Tách ra làm lệch khỏi upstream và khó
    // cập nhật; Fast Refresh chỉ ảnh hưởng lúc dev (mất state khi sửa file), không ảnh hưởng production.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
