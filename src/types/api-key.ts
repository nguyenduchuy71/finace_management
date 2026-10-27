import { z } from 'zod'

/**
 * API key cho iOS Shortcut (bảng `api_keys`). Client KHÔNG bao giờ thấy hash hay key đầy
 * đủ sau lần tạo: chỉ `prefix` ("vj_" + 6 ký tự) và `last4` để nhận ra key nào là key nào.
 */
export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  last4: z.string(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
})
export type ApiKey = z.infer<typeof ApiKeySchema>

/** Trần do trigger `api_keys_guard` áp ở DB — UI dùng để khoá nút tạo sớm. */
export const MAX_ACTIVE_API_KEYS = 10

export const UserSettingsSchema = z.object({
  ownerNames: z.array(z.string()),
  privacyConsentAt: z.string().datetime().nullable(),
  privacyPolicyVersion: z.string().nullable(),
})
export type UserSettings = z.infer<typeof UserSettingsSchema>

/** Trần do CHECK `cardinality(owner_names) <= 10` ở DB. */
export const MAX_OWNER_NAMES = 10

/** Độ dài mỗi tên, khớp CHECK `owner_names_ok` ở DB (tên < 3 ký tự edge function bỏ qua). */
export const OWNER_NAME_LENGTH = { min: 3, max: 100 } as const

/**
 * Phiên bản chính sách bảo mật user đồng ý lúc đăng ký — gửi qua metadata signUp,
 * trigger `handle_new_user` ghi vào `user_settings`. Đổi nội dung chính sách thì tăng số này.
 */
export const PRIVACY_POLICY_VERSION = '2026-10'
