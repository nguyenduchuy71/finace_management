import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/utils/currency'
import type { CategoryBreakdownItem } from '@/services/dashboard'

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316',
  grocery: '#84cc16',
  shopping: '#a855f7',
  transport: '#3b82f6',
  electronics: '#06b6d4',
  transfer: '#6b7280',
  entertainment: '#ec4899',
  dining: '#f59e0b',
  other: '#9ca3af',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Ăn uống',
  grocery: 'Thực phẩm',
  shopping: 'Mua sắm',
  transport: 'Di chuyển',
  electronics: 'Điện tử',
  transfer: 'Chuyển khoản',
  entertainment: 'Giải trí',
  dining: 'Nhà hàng',
  income: 'Thu nhập',
  other: 'Khác',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

interface TooltipPayloadItem {
  name: string
  value: number
  payload: { percentage: number }
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground">{formatVND(item.value)}</p>
      <p className="text-muted-foreground">{item.payload.percentage}%</p>
    </div>
  )
}

interface CategoryChartProps {
  categoryBreakdown: CategoryBreakdownItem[]
}

export function CategoryChart({ categoryBreakdown }: CategoryChartProps) {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut')

  // CRITICAL: useMemo depends ONLY on categoryBreakdown.
  // searchQuery, accountId, cardId are intentionally NOT in deps.
  // categoryBreakdown only changes when dateFrom/dateTo change (via useDashboardStats queryKey).
  // This means chart data does NOT recalculate when the user types in the search box.
  const chartData = useMemo(() => {
    const total = categoryBreakdown.reduce((sum, item) => sum + item.amount, 0)
    return categoryBreakdown.map((item) => ({
      name: getCategoryLabel(item.category),
      value: item.amount,
      color: getCategoryColor(item.category),
      percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0,
    }))
  }, [categoryBreakdown])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Chi tiêu theo danh mục
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Không có dữ liệu danh mục</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Chi tiêu theo danh mục
        </CardTitle>
        <div className="flex gap-1">
          <Button
            variant={chartType === 'donut' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('donut')}
            className="min-h-[36px] text-xs px-2"
          >
            Donut
          </Button>
          <Button
            variant={chartType === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('bar')}
            className="min-h-[36px] text-xs px-2"
          >
            Cột
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartType === 'donut' ? 260 : 280}>
          {chartType === 'donut' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="75%"
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11 }}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
