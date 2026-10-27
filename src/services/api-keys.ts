import { supabase } from '@/lib/supabase'
import { toApiError } from './api-errors'
import { ApiKeySchema, type ApiKey } from '@/types/api-key'

/** Cột được cấp quyền đọc (key_hash / rl_* bị revoke với authenticated — select '*' sẽ 42501). */
const API_KEY_COLUMNS = 'id, name, prefix, last4, created_at, last_used_at, revoked_at'

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  last4: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const toISO = (v: string | null) => (v === null ? null : new Date(v).toISOString())

function mapApiKey(row: ApiKeyRow): ApiKey {
  return ApiKeySchema.parse({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    last4: row.last4,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: toISO(row.last_used_at),
    revokedAt: toISO(row.revoked_at),
  })
}

const API_KEY_ERRORS: Record<string, string> = {
  // 22023 từ create_api_key (tên) hoặc trigger api_keys_guard (trần 10 key / bỏ thu hồi)
  '22023': 'Không tạo được key: tên phải 1–50 ký tự và tối đa 10 key còn hiệu lực.',
}

/** Key còn hiệu lực trước, mới nhất trước. */
export async function listApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select(API_KEY_COLUMNS)
    .order('revoked_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
  if (error) throw toApiError(error)
  return (data as ApiKeyRow[]).map(mapApiKey)
}

/** Trả key ĐẦY ĐỦ — lần duy nhất nó xuất hiện; DB chỉ giữ SHA-256. */
export async function createApiKey(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_api_key', { p_name: name })
  if (error) throw toApiError(error, API_KEY_ERRORS)
  return String(data)
}

/** Thu hồi vĩnh viễn (trigger chặn bỏ thu hồi). Edge function từ chối key ngay request kế. */
export async function revokeApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
  // 22023 ở đây chỉ có thể là trigger chặn sửa key đã thu hồi.
  if (error) throw toApiError(error, { '22023': 'Key này đã bị thu hồi trước đó.' })
}
