import type { Category } from '@/types/categories'

/**
 * Màu biểu đồ theo danh mục — CSS var (`--chart-n` trong index.css) nên tự đổi theo theme.
 * Cùng tông với `CategoryBadge` (cam/hồng/xanh dương/tím/hổ phách/xám) để badge và lát biểu đồ khớp nhau.
 *
 * Khoá là giá trị `transactions.category` thật (6 Category tiếng Việt) mà RPC
 * `get_dashboard_stats` trả về — KHÔNG phải khoá tiếng Anh (bản cũ tra theo `food`/`shopping`
 * nên mọi lát rơi về màu "khác").
 */
const CATEGORY_CHART_COLOR: Record<Category, string> = {
  'Ăn uống': 'var(--chart-1)',
  'Mua sắm': 'var(--chart-2)',
  'Di chuyển': 'var(--chart-3)',
  'Giải trí': 'var(--chart-4)',
  'Hóa đơn': 'var(--chart-5)',
  'Khác': 'var(--chart-6)',
}

/** Danh mục lạ (dữ liệu cũ, nhập tay) dùng màu "Khác" — không bao giờ trả undefined. */
export function getCategoryChartColor(category: string): string {
  return CATEGORY_CHART_COLOR[category as Category] ?? CATEGORY_CHART_COLOR['Khác']
}
