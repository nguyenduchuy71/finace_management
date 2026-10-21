import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { toApiError } from './api-errors'

export const CategoryBreakdownItemSchema = z.object({
  category: z.string(),
  amount: z.number().int(),
})

export const DashboardStatsSchema = z.object({
  totalIncome: z.number().int(),
  totalExpense: z.number().int(),
  bankIncome: z.number().int(),
  bankExpense: z.number().int(),
  ccIncome: z.number().int(),
  ccExpense: z.number().int(),
  categoryBreakdown: z.array(CategoryBreakdownItemSchema),
  transactionCount: z.number().int(),
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>
export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItemSchema>

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
