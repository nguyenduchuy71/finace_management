import { supabase } from '@/lib/supabase'
import { toApiError } from './api-errors'
import { UserSettingsSchema, type UserSettings } from '@/types/api-key'

interface UserSettingsRow {
  owner_names: string[] | null
  privacy_consent_at: string | null
  privacy_policy_version: string | null
  suspended_at: string | null
}

/** Dòng do trigger đăng ký tạo sẵn; RLS chỉ trả dòng của chính user. */
export async function getUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('owner_names, privacy_consent_at, privacy_policy_version, suspended_at')
    .single()
  if (error) throw toApiError(error)
  const row = data as UserSettingsRow
  return UserSettingsSchema.parse({
    ownerNames: row.owner_names ?? [],
    privacyConsentAt: row.privacy_consent_at ? new Date(row.privacy_consent_at).toISOString() : null,
    privacyPolicyVersion: row.privacy_policy_version,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at).toISOString() : null,
  })
}

/**
 * Tên chủ TK để edge function nhận diện chuyển nội bộ (thay env OWNER_NAMES cũ).
 * Chuẩn hoá: bỏ khoảng trắng thừa, bỏ trùng (không phân biệt hoa thường), bỏ rỗng.
 */
export function normalizeOwnerNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ')
    const key = name.toLocaleUpperCase('vi')
    if (name && !seen.has(key)) { seen.add(key); out.push(name) }
  }
  return out
}

export async function updateOwnerNames(names: string[]): Promise<string[]> {
  const ownerNames = normalizeOwnerNames(names)
  const { data, error } = await supabase
    .from('user_settings')
    .update({ owner_names: ownerNames })
    .select('owner_names')
    .single()
  if (error) throw toApiError(error, { '23514': 'Tối đa 10 tên chủ tài khoản.' })
  return (data as { owner_names: string[] }).owner_names
}
