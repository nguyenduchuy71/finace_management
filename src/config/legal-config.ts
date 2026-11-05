import { LEGAL_ENV_KEYS } from './legal-env-guard'

/** Nơi DUY NHẤT đọc thông tin pháp lý (chủ vận hành, email liên hệ, vùng lưu dữ liệu) từ biến môi trường. */
export const LEGAL_PLACEHOLDER = '[chưa điền]'

export type LegalConfig = { operatorName: string; contactEmail: string; dataRegion: string }

export function resolveLegalConfig(env: Record<string, string | undefined>): LegalConfig {
  const [operator, email, region] = LEGAL_ENV_KEYS.map((key) => env[key]?.trim() || LEGAL_PLACEHOLDER)
  return { operatorName: operator, contactEmail: email, dataRegion: region }
}

export const legalConfig: LegalConfig = resolveLegalConfig(import.meta.env as Record<string, string | undefined>)
