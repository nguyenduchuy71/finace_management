import type { Category } from '@/types/categories'

export const CATEGORY_TAXONOMY: Record<Category, string[]> = {
  'Ăn uống': ['circle k', 'highlands coffee', 'the coffee house', 'pho', 'restaurant', 'cafe', 'burger', 'pizza'],
  'Mua sắm': ['shopee', 'lazada', 'tiki', 'sendo', 'mall', 'supermarket'],
  'Di chuyển': ['grab', 'be', 'gojek', 'taxi', 'parking', 'xăng dầu', 'gas station'],
  'Giải trí': ['cgv', 'netflix', 'spotify', 'gym', 'cinema'],
  'Hóa đơn': ['electricity', 'water', 'internet', 'phone bill', 'điện', 'nước'],
  'Khác': [],
}

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g

/**
 * Từ khoá khớp theo RANH GIỚI TỪ (chữ/số Unicode, gồm cả chữ có dấu): khớp chuỗi con từng xếp
 * "Phone bill" vào Ăn uống ("pho") và "Beauty Salon" vào Di chuyển ("be"). Không dùng lookbehind
 * vì Safari < 16.4 ném SyntaxError khi nạp module (xem `mcc.ts`).
 */
const MATCHERS = (Object.entries(CATEGORY_TAXONOMY) as [Category, string[]][]).map(([category, keywords]) => ({
  category,
  res: keywords.map((kw) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${kw.replace(ESCAPE_REGEX, '\\$&')}(?![\\p{L}\\p{N}])`, 'u')),
}))

export function classifyTransaction(merchant: string | undefined): Category {
  if (!merchant) return 'Khác'
  const query = merchant.normalize('NFC').toLowerCase()
  return MATCHERS.find(({ res }) => res.some((re) => re.test(query)))?.category ?? 'Khác'
}

export function getCategoryLabel(category: Category): string {
  return category
}
