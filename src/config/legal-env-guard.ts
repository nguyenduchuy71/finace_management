/**
 * Kiểm biến pháp lý cho build production. File thuần (không import.meta / process) để vite.config.ts dùng
 * và unit test chạy được.
 */
export const LEGAL_ENV_KEYS = ['VITE_LEGAL_OPERATOR_NAME', 'VITE_LEGAL_CONTACT_EMAIL', 'VITE_DATA_REGION'] as const

/** Tên các biến còn trống (thiếu hoặc chỉ có khoảng trắng). */
export function missingLegalEnv(env: Record<string, string | undefined>): string[] {
  return LEGAL_ENV_KEYS.filter((key) => !env[key]?.trim())
}

/**
 * Chỉ chặn khi `vercelEnv === 'production'`: build local và job CI `verify` (không đặt VERCEL_ENV)
 * vẫn qua, dev thấy marker "[chưa điền]" trên trang pháp lý.
 */
export function assertLegalEnv(vercelEnv: string | undefined, env: Record<string, string | undefined>): void {
  if (vercelEnv !== 'production') return
  const missing = missingLegalEnv(env)
  if (missing.length > 0) {
    throw new Error(
      `Build production thiếu biến pháp lý: ${missing.join(', ')}. ` +
      'Đặt trong Vercel (Settings > Environment Variables, môi trường Production) — trang /privacy và /terms ' +
      'không được công bố với thông tin trống.',
    )
  }
}
