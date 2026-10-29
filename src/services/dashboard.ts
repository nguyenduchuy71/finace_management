import { supabase } from '@/lib/supabase'
import { DashboardStatsSchema, type DashboardStats } from '@/types/dashboard'
import { toApiError } from './api-errors'

export interface DashboardFilters {
  dateFrom?: string | null
  dateTo?: string | null
}

export async function getDashboardStats(filters?: DashboardFilters): Promise<DashboardStats> {
  // Aggregate ở DB (RPC) thay vì kéo hết row về client.
  // RPC dùng `security invoker` nên tôn trọng RLS của user đang đăng nhập.
  const { data, error } = await supabase.rpc('get_dashboard_stats', {
    p_date_from: filters?.dateFrom ?? null,
    p_date_to: filters?.dateTo ?? null,
  })

  if (error) throw toApiError(error)
  return DashboardStatsSchema.parse(data)
}
