import { z } from 'zod'
import { moneyAmountField } from './form-fields'
import type { CashbackRule } from './cashback'

/** Nhãn của rule mặc định (mcc = null) ở mọi nơi hiển thị rule. */
export const DEFAULT_RULE_LABEL = 'Mọi giao dịch còn lại (mặc định)'

/** Tối đa bậc thêm mỗi rule; khớp giới hạn của RPC save_cashback_rule ở DB. */
export const MAX_TIERS = 5

/** Dòng bậc thang trong form. `key` chỉ để React nhận diện dòng (xoá dòng giữa danh sách không lệch giá trị), không gửi đi. */
export interface TierFormRow { key: string; minSpend: string; ratePercent: string }

let tierKeySeq = 0
export const newTierKey = () => `tier-${++tierKeySeq}`

const ratePercentField = z.string().trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Nhập % như 5 hoặc 5,5 (tối đa 2 số lẻ)')
  .transform((s) => Number(s.replace(',', '.')))
  .refine((n) => n >= 0 && n <= 100, 'Tỷ lệ từ 0 đến 100')

/** Để trống = không giới hạn. Gõ "0" là lỗi: dễ hiểu nhầm thành "không hoàn" trong khi DB cấm 0. */
const optionalCapField = (label: string) => z.string().trim().transform((s, ctx) => {
  if (s === '') return null
  const parsed = moneyAmountField(label).safeParse(s)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: parsed.error.issues[0].message })
    return z.NEVER
  }
  if (parsed.data <= 0) {
    ctx.addIssue({ code: 'custom', message: `${label} phải lớn hơn 0 (để trống nếu không giới hạn)` })
    return z.NEVER
  }
  return parsed.data
})

/** Trần hoàn tiền tổng của thẻ (ô riêng trong editor). */
export const CardCapFormSchema = optionalCapField('Trần hoàn cả thẻ')

/** Input là chuỗi (đúng như ô nhập), output là giá trị đã chuẩn hoá để gửi lên DB. */
export const CashbackRuleFormSchema = z.object({
  // '' = rule mặc định cho mọi giao dịch không khớp rule MCC nào. Mã 4 chữ số ngoài danh sách vẫn nhận
  // (ngân hàng có thể dùng mã mới hơn bộ dữ liệu); khớp check `^[0-9]{4}$` ở DB.
  mcc: z.string()
    .refine((v) => v === '' || /^\d{4}$/.test(v), 'MCC phải gồm 4 chữ số')
    .transform((v) => (v === '' ? null : v)),
  // Tối đa 2 số lẻ (khớp numeric(5,2) ở DB); chấp nhận dấu phẩy kiểu Việt: "5,5"
  ratePercent: ratePercentField,
  // Để trống = 0 (không đòi chi tối thiểu)
  minCycleSpend: moneyAmountField('Ngưỡng chi'),
  capPerCycle: optionalCapField('Trần hoàn'),
  // `key` không có trong schema nên Zod bỏ nó khỏi output.
  tiers: z.array(z.object({
    minSpend: z.string().trim().min(1, 'Nhập mức chi').pipe(moneyAmountField('Mức chi')),
    ratePercent: ratePercentField,
  })).max(MAX_TIERS, `Tối đa ${MAX_TIERS} bậc`),
}).superRefine((v, ctx) => {
  // Liên dòng: tăng dần chặt và bậc đầu lớn hơn ngưỡng nền (RPC ở DB kiểm lại).
  // Ô ngưỡng nền sai định dạng thì không có số để so: đừng báo thêm lỗi giả ở các dòng bậc.
  if (typeof v.minCycleSpend !== 'number') return
  let prev = v.minCycleSpend
  v.tiers.forEach((tier, i) => {
    if (tier.minSpend <= prev) {
      ctx.addIssue({
        code: 'custom', path: ['tiers', i, 'minSpend'],
        message: i === 0
          ? 'Phải lớn hơn mức chi tối thiểu của rule'
          : 'Phải lớn hơn mức chi của bậc trước',
      })
    }
    prev = Math.max(prev, tier.minSpend)
  })
})

export type CashbackFormInput = Omit<z.input<typeof CashbackRuleFormSchema>, 'tiers'> & { tiers: TierFormRow[] }
export type CashbackFormValues = z.output<typeof CashbackRuleFormSchema>
/** Trường đơn của form (không tính danh sách bậc). */
export type CashbackScalarField = Exclude<keyof CashbackFormInput, 'tiers'>
export type CashbackFormErrors = Partial<Record<CashbackScalarField, string>> & {
  /** Lỗi chung của danh sách bậc (vd quá nhiều bậc). */
  tiers?: string
  /** Lỗi theo từng dòng bậc, cùng chỉ số với `tiers` của form. */
  tierRows?: { minSpend?: string; ratePercent?: string }[]
}

export const EMPTY_CASHBACK_FORM: CashbackFormInput = {
  mcc: '', ratePercent: '', minCycleSpend: '', capPerCycle: '', tiers: [],
}

export function ruleToFormInput(rule: CashbackRule): CashbackFormInput {
  return {
    mcc: rule.mcc ?? '',
    ratePercent: String(rule.ratePercent),
    minCycleSpend: rule.minCycleSpend > 0 ? String(rule.minCycleSpend) : '',
    capPerCycle: rule.capPerCycle !== null ? String(rule.capPerCycle) : '',
    tiers: rule.tiers.map((t) => ({ key: newTierKey(), minSpend: String(t.minSpend), ratePercent: String(t.ratePercent) })),
  }
}

export function validateCashbackForm(
  input: CashbackFormInput
): { ok: true; values: CashbackFormValues } | { ok: false; errors: CashbackFormErrors } {
  const result = CashbackRuleFormSchema.safeParse(input)
  if (result.success) return { ok: true, values: result.data }
  const errors: CashbackFormErrors = {}
  for (const issue of result.error.issues) {
    const [field, row, col] = issue.path
    if (field === 'tiers' && typeof row === 'number' && (col === 'minSpend' || col === 'ratePercent')) {
      const rows = (errors.tierRows ??= [])
      rows[row] ??= {}
      rows[row][col] ??= issue.message
    } else if (field === 'tiers') {
      errors.tiers ??= issue.message
    } else {
      const key = field as CashbackScalarField
      if (!errors[key]) errors[key] = issue.message
    }
  }
  return { ok: false, errors }
}
