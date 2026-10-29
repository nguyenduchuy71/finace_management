import { z } from 'zod'

/** Nguồn DUY NHẤT của danh sách Category (tên tiếng Việt — cũng là khoá của taxonomy, màu biểu đồ, ngân sách). */
export const CATEGORIES = ['Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Hóa đơn', 'Khác'] as const

export const CategorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof CategorySchema>

const ReadCategorySchema = CategorySchema.catch('Khác')

/**
 * Category đọc từ DB: chuỗi lạ (dữ liệu cũ / giá trị ngoài danh sách) về 'Khác' thay vì làm Zod
 * ném lỗi và hỏng cả danh sách giao dịch. Chỉ dùng cho giá trị ĐỌC; ghi vẫn phải qua CategorySchema.
 * Kiểu suy ra giữ là `string` (fixture/test dùng nhãn tự do); sau parse giá trị luôn thuộc Category,
 * nên chỗ cần Category (TransactionRow, form sửa) ép kiểu an toàn.
 */
export const StoredCategorySchema = z.string().transform((v): string => ReadCategorySchema.parse(v))
