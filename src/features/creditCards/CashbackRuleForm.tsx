import { useState } from 'react'
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useSaveCashbackRule } from '@/hooks/useCashbackRules'
import { CashbackTierFields } from './CashbackTierFields'
import {
  DEFAULT_RULE_LABEL, EMPTY_CASHBACK_FORM, ruleToFormInput, validateCashbackForm,
  type CashbackFormErrors, type CashbackFormInput, type CashbackScalarField,
} from '@/types/cashback-form'
import type { CashbackRule } from '@/types/cashback'
import type { ApiError } from '@/types/api'
import { MCC_OPTIONS, formatMcc } from '@/utils/mcc'

const FIELD_ID: Record<CashbackScalarField, string> = {
  mcc: 'rule-mcc',
  ratePercent: 'rule-rate',
  minCycleSpend: 'rule-min',
  capPerCycle: 'rule-cap',
}

interface CashbackRuleFormProps {
  cardId: string
  /** Có rule = sửa, không có = thêm mới. */
  rule: CashbackRule | null
  /** Rule hiện có của thẻ: để khoá các nhóm MCC đã có rule (mỗi thẻ chỉ một rule cho mỗi nhóm). */
  existing: CashbackRule[]
  onDone: () => void
  setBusy: (busy: boolean) => void
}

export function CashbackRuleForm({ cardId, rule, existing, onDone, setBusy }: CashbackRuleFormProps) {
  const [form, setForm] = useState<CashbackFormInput>(() => {
    if (rule) return ruleToFormInput(rule)
    // Rule mới: chọn sẵn nhóm đầu tiên CHƯA có rule. Mặc định '' (rule mặc định) mà đã bị chiếm
    // thì <select> hiện một mục bị khoá, user bấm Thêm và nhận lỗi trùng không nói rõ phải đổi gì.
    const taken = new Set(existing.map((r) => r.mcc ?? ''))
    const firstFree = ['', ...MCC_OPTIONS.map((o) => o.code)].find((m) => !taken.has(m)) ?? ''
    return { ...EMPTY_CASHBACK_FORM, mcc: firstFree }
  })
  const [errors, setErrors] = useState<CashbackFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const save = useSaveCashbackRule(cardId)

  // Nhóm đã có rule ở rule KHÁC thì không cho chọn lại (DB cũng chặn bằng unique).
  const taken = new Set(existing.filter((r) => r.id !== rule?.id).map((r) => r.mcc ?? ''))

  const fieldProps = (key: CashbackScalarField) => ({
    id: FIELD_ID[key],
    value: form[key],
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': describedBy(FIELD_ID[key], Boolean(errors[key])),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
      setSubmitError(null)
    },
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    setSubmitError(null)
    const result = validateCashbackForm(form)
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    setBusy(true)
    try {
      await save.mutateAsync({ ruleId: rule?.id ?? null, values: result.values })
      onDone()
    } catch (err) {
      setSubmitError((err as ApiError).message ?? 'Không lưu được rule. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="rule-mcc" label="Áp dụng cho" error={errors.mcc}>
        <NativeSelect {...fieldProps('mcc')}>
          <option value="" disabled={taken.has('')}>{DEFAULT_RULE_LABEL}</option>
          {MCC_OPTIONS.map((o) => (
            <option key={o.code} value={o.code} disabled={taken.has(o.code)}>{formatMcc(o.code)}</option>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="rule-rate" label="Hoàn (%)" error={errors.ratePercent}>
          <Input {...fieldProps('ratePercent')} inputMode="decimal" placeholder="5" />
        </FormField>
        <FormField
          id="rule-min" label="Chi tối thiểu / kỳ (đ)" error={errors.minCycleSpend}
          hint="Để trống nếu không yêu cầu"
        >
          <Input {...fieldProps('minCycleSpend')} inputMode="numeric" placeholder="3.000.000" />
        </FormField>
        <FormField
          id="rule-cap" label="Trần hoàn / kỳ (đ)" error={errors.capPerCycle}
          hint="Để trống nếu không giới hạn"
        >
          <Input {...fieldProps('capPerCycle')} inputMode="numeric" placeholder="200.000" />
        </FormField>
      </div>

      <CashbackTierFields
        tiers={form.tiers} errors={errors} disabled={save.isPending}
        onChange={(tiers) => {
          setForm((f) => ({ ...f, tiers }))
          setErrors((prev) => ({ ...prev, tiers: undefined, tierRows: undefined }))
          setSubmitError(null)
        }}
      />

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>Huỷ</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : rule ? 'Lưu rule' : 'Thêm rule'}
        </Button>
      </div>
    </form>
  )
}
