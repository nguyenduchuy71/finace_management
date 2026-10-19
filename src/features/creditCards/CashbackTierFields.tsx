import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_TIERS, newTierKey, type CashbackFormErrors, type TierFormRow } from '@/types/cashback-form'

interface CashbackTierFieldsProps {
  tiers: TierFormRow[]
  errors: CashbackFormErrors
  disabled: boolean
  onChange: (tiers: TierFormRow[]) => void
}

/**
 * Danh sách bậc thang của một rule. Dòng nhận diện bằng `key` riêng chứ không theo chỉ số, nên xoá
 * dòng giữa danh sách không làm lệch giá trị đang gõ sang dòng khác.
 */
export function CashbackTierFields({ tiers, errors, disabled, onChange }: CashbackTierFieldsProps) {
  const update = (key: string, patch: Partial<TierFormRow>) =>
    onChange(tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  return (
    <fieldset className="space-y-3 rounded-md border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Bậc thang (tuỳ chọn)</legend>
      <p className="text-xs text-muted-foreground">
        Chi đạt bậc nào thì % của bậc đó áp cho <strong>toàn bộ</strong> khoản chi của nhóm (không lũy tiến).
        Bậc đầu tiên phải lớn hơn mức chi tối thiểu ở trên.
      </p>

      {tiers.map((t, i) => {
        const rowErrors = errors.tierRows?.[i]
        const minId = `${t.key}-min`
        const rateId = `${t.key}-rate`
        return (
          <div key={t.key} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <FormField id={minId} label={`Bậc ${i + 1}: chi từ (đ)`} error={rowErrors?.minSpend}>
              <Input
                id={minId} value={t.minSpend} inputMode="numeric" placeholder="10.000.000"
                aria-invalid={rowErrors?.minSpend ? true : undefined}
                aria-describedby={describedBy(minId, Boolean(rowErrors?.minSpend))}
                onChange={(e) => update(t.key, { minSpend: e.target.value })}
              />
            </FormField>
            <FormField id={rateId} label={`Bậc ${i + 1}: hoàn (%)`} error={rowErrors?.ratePercent}>
              <Input
                id={rateId} value={t.ratePercent} inputMode="decimal" placeholder="1"
                aria-invalid={rowErrors?.ratePercent ? true : undefined}
                aria-describedby={describedBy(rateId, Boolean(rowErrors?.ratePercent))}
                onChange={(e) => update(t.key, { ratePercent: e.target.value })}
              />
            </FormField>
            <Button
              type="button" variant="outline" size="sm" className="sm:mt-6"
              aria-label={`Xoá bậc ${i + 1}`}
              onClick={() => onChange(tiers.filter((x) => x.key !== t.key))}
            >Xoá</Button>
          </div>
        )
      })}

      {errors.tiers && <p role="alert" className="text-xs text-destructive">{errors.tiers}</p>}

      {tiers.length < MAX_TIERS && (
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => onChange([...tiers, { key: newTierKey(), minSpend: '', ratePercent: '' }])}
        >Thêm bậc</Button>
      )}
    </fieldset>
  )
}
