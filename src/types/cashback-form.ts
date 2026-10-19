import { z } from 'zod'
import { MCC_OPTIONS } from '@/utils/mcc'
import { moneyAmountField } from './form-fields'
import type { CashbackRule } from './cashback'

/** Nhãn của rule mặc định (mcc = null) ở mọi nơi hiển thị rule. */
export const DEFAULT_RULE_LABEL = 'Mọi giao dịch còn lại (mặc định)'

const MCC_CODES = new Set(MCC_OPTIONS.map((o) => o.code))

/** Input là chuỗi (đúng như ô nhập), output là giá trị đã chuẩn hoá để gửi lên DB. */
export const CashbackRuleFormSchema = z.object({
  // '' = rule mặc định cho mọi giao dịch không khớp rule MCC nào
  mcc: z.string()
    .refine((v) => v === '' || MCC_CODES.has(v), 'Chọn nhóm MCC trong danh sách')
    .transform((v) => (v === '' ? null : v)),
  // Tối đa 2 số lẻ (khớp numeric(5,2) ở DB); chấp nhận dấu phẩy kiểu Việt: "5,5"
  ratePercent: z.string().trim()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Nhập % như 5 hoặc 5,5 (tối đa 2 số lẻ)')
    .transform((s) => Number(s.replace(',', '.')))
    .refine((n) => n >= 0 && n <= 100, 'Tỷ lệ từ 0 đến 100'),
  // Để trống = 0 (không đòi chi tối thiểu)
  minCycleSpend: moneyAmountField('Ngưỡng chi'),
  // Để trống = không giới hạn. Gõ "0" là lỗi: dễ hiểu nhầm thành "không hoàn" trong khi DB cấm 0.
  capPerCycle: z.string().trim().transform((s, ctx) => {
    if (s === '') return null
    const parsed = moneyAmountField('Trần hoàn').safeParse(s)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: parsed.error.issues[0].message })
      return z.NEVER
    }
    if (parsed.data <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Trần hoàn phải lớn hơn 0 (để trống nếu không giới hạn)' })
      return z.NEVER
    }
    return parsed.data
  }),
})

export type CashbackFormInput = z.input<typeof CashbackRuleFormSchema>
export type CashbackFormValues = z.output<typeof CashbackRuleFormSchema>
export type CashbackFormErrors = Partial<Record<keyof CashbackFormInput, string>>

export const EMPTY_CASHBACK_FORM: CashbackFormInput = {
  mcc: '', ratePercent: '', minCycleSpend: '', capPerCycle: '',
}

export function ruleToFormInput(rule: CashbackRule): CashbackFormInput {
  return {
    mcc: rule.mcc ?? '',
    ratePercent: String(rule.ratePercent),
    minCycleSpend: rule.minCycleSpend > 0 ? String(rule.minCycleSpend) : '',
    capPerCycle: rule.capPerCycle !== null ? String(rule.capPerCycle) : '',
  }
}

export function validateCashbackForm(
  input: CashbackFormInput
): { ok: true; values: CashbackFormValues } | { ok: false; errors: CashbackFormErrors } {
  const result = CashbackRuleFormSchema.safeParse(input)
  if (result.success) return { ok: true, values: result.data }
  const errors: CashbackFormErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof CashbackFormInput
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
