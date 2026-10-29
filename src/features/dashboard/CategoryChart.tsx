import { useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatVND } from '@/utils/currency'
import { getCategoryChartColor } from '@/utils/category-colors'
import type { CategoryBreakdownItem } from '@/types/dashboard'

interface TooltipPayloadItem {
  name: string
  value: number
  payload: { percentage: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border bg-popover p-2 shadow-md text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground money">{formatVND(item.value)} · {item.payload.percentage}%</p>
    </div>
  )
}

interface CategoryChartProps {
  categoryBreakdown: CategoryBreakdownItem[]
}

/**
 * Chi theo danh mục: donut (tỉ trọng) + bảng xếp hạng có thanh ngang (đọc số nhanh hơn
 * so màu trên donut; cũng là bản thay thế dạng văn bản cho biểu đồ — a11y).
 */
export function CategoryChart({ categoryBreakdown }: CategoryChartProps) {
  // CRITICAL: useMemo depends ONLY on categoryBreakdown.
  // searchQuery, accountId, cardId are intentionally NOT in deps.
  // categoryBreakdown only changes when dateFrom/dateTo change (via useDashboardStats queryKey).
  // This means chart data does NOT recalculate when the user types in the search box.
  const chartData = useMemo(() => {
    const total = categoryBreakdown.reduce((sum, item) => sum + item.amount, 0)
    return [...categoryBreakdown]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        name: item.category,
        value: item.amount,
        color: getCategoryChartColor(item.category),
        percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0,
      }))
  }, [categoryBreakdown])

  const maxValue = chartData[0]?.value ?? 0

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="heading-label text-muted-foreground">Chi tiêu theo danh mục</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Không có dữ liệu danh mục</p>
          </div>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
            <div aria-hidden className="mx-auto h-[220px] w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ol className="space-y-3" aria-label="Xếp hạng chi tiêu theo danh mục">
              {chartData.map((entry) => (
                <li key={entry.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                      <span className="truncate font-medium">{entry.name}</span>
                      <span className="text-xs text-muted-foreground">{entry.percentage}%</span>
                    </span>
                    <span className="money shrink-0 font-semibold">{formatVND(entry.value)}</span>
                  </div>
                  <div aria-hidden className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${maxValue > 0 ? (entry.value / maxValue) * 100 : 0}%`, background: entry.color }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
