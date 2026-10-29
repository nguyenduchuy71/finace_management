import { z } from 'zod'

/** Nguồn DUY NHẤT của danh sách Category (tên tiếng Việt — cũng là khoá của taxonomy, màu biểu đồ, ngân sách). */
export const CATEGORIES = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Hóa đơn', 'Khác'] as const

export const CategorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof CategorySchema>
