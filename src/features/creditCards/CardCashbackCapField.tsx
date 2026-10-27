import { useState } from 'react'
import { FormField } from '@/components/form/FormField'
import { describedBy } from '@/components/form/form-aria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSetCardCashbackCap } from '@/hooks/useCashbackRules'
import { CardCapFormSchema } from '@/types/cashback-form'
import type { CreditCard } from '@/types/creditCard'
import { getErrorMessage } from '@/services/api-errors'

const FIELD_ID = 'card-cashback-cap'

interface CardCashbackCapFieldProps {
  card: CreditCard
  setBusy: (busy: boolean) => void
}

/** Trần hoàn tiền tổng cho cả thẻ mỗi kỳ sao kê: lưu riêng, áp SAU trần của từng rule. */
export function CardCashbackCapField({ card, setBusy }: CardCashbackCapFieldProps) {
  const [value, setValue] = useState(card.cashbackMonthlyCap !== null ? String(card.cashbackMonthlyCap) : '')
  const [error, setError] = useState<string | null>(null)
  const save = useSetCardCashbackCap(card.id)

  async function onSave() {
    if (save.isPending) return
    const parsed = CardCapFormSchema.safeParse(value)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setError(null)
    setBusy(true)
    try {
      await save.mutateAsync(parsed.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được trần hoàn tiền.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border p-3">
      <div className="min-w-48 flex-1">
        <FormField
          id={FIELD_ID} label="Trần hoàn tiền cả thẻ / kỳ (đ)" error={error ?? undefined}
          hint="Tổng hoàn của mọi rule bị cắt về mức này. Để trống nếu không giới hạn."
        >
          <Input
            id={FIELD_ID} value={value} inputMode="numeric" placeholder="600.000"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(FIELD_ID, Boolean(error))}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
          />
        </FormField>
      </div>
      <Button type="button" variant="outline" className="sm:mt-6" disabled={save.isPending} onClick={onSave}>
        {save.isPending ? 'Đang lưu…' : 'Lưu trần'}
      </Button>
    </div>
  )
}
