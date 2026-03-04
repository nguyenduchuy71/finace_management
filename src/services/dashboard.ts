import { z } from 'zod'
import { apiClient } from './apiClient'

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
  const response = await apiClient.get('/dashboard/stats', {
    params: {
      ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters?.dateTo && { dateTo: filters.dateTo }),
    },
  })
  return DashboardStatsSchema.parse(response.data)
}
