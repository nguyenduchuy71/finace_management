import type { Category } from '@/types/categories'

export const CATEGORY_TAXONOMY: Record<Category, string[]> = {
  'Ăn uống': ['circle k', 'highlands coffee', 'the coffee house', 'pho', 'restaurant', 'cafe', 'burger', 'pizza'],
  'Mua sắm': ['shopee', 'lazada', 'tiki', 'sendo', 'mall', 'supermarket'],
  'Di chuyển': ['grab', 'be', 'gojek', 'taxi', 'parking', 'xăng dầu', 'gas station'],
  'Giải trí': ['cgv', 'netflix', 'spotify', 'gym', 'cinema'],
  'Hóa đơn': ['electricity', 'water', 'internet', 'phone bill', 'điện', 'nước'],
  'Khác': [],
}

export function classifyTransaction(merchant: string | undefined): Category {
  if (!merchant) return 'Khác'
  const query = merchant.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_TAXONOMY)) {
    if (keywords.some((kw) => query.includes(kw))) {
      return category as Category
    }
  }
  return 'Khác'
}

export function getCategoryLabel(category: Category): string {
  return category
}
