import { z } from 'zod'

/**
 * Ô nhập số tiền VND (chuỗi -> số nguyên). Để trống = 0.
 *
 * Chỉ nhận số thuần ("50000000") hoặc nhóm nghìn đúng chuẩn với CÙNG MỘT dấu tách ở mọi chỗ
 * ("50.000.000", "50,000,000", "50 000 000"). Không đoán các dạng khác: "1.5" / "1,5" từng âm
 * thầm thành 15đ, "1.500.00" thành 150.000đ, và "1,000.000" (lẫn hai kiểu dấu) thành 1.000.000đ —
 * số tiền sai mà người dùng không hề biết.
 */
export const moneyAmountField = (label: string) =>
  z.string().trim()
    .regex(
      /^(?:\d+|\d{1,3}(?:([.,\s])\d{3}(?:\1\d{3})*))?$/,
      `${label} sai định dạng, ví dụ 50.000.000 hoặc 50000000`
    )
    .transform((s) => Number(s.replace(/[.,\s]/g, '') || '0'))
    .refine(Number.isSafeInteger, `${label} quá lớn`)
