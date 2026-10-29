import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useCashbackRules, useDeleteCashbackRule } from '@/hooks/useCashbackRules'
import { formatVND } from '@/utils/currency'
import { formatMcc } from '@/utils/mcc'
import type { CashbackRule } from '@/types/cashback'
import type { CreditCard } from '@/types/creditCard'
import { DEFAULT_RULE_LABEL } from '@/types/cashback-form'
import { CashbackRuleForm } from './CashbackRuleForm'
import { CardCashbackCapField } from './CardCashbackCapField'
import { getErrorMessage } from '@/services/api-errors'
import { useDialogBusyGuard } from '@/hooks/useDialogBusyGuard'

interface CashbackRulesEditorProps {
  card: CreditCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Đang xem danh sách, thêm rule mới, hoặc sửa một rule (theo id). */
type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; ruleId: string }

function describeRule(r: CashbackRule): string {
  const parts = [`Hoàn ${r.ratePercent}%`]
  if (r.minCycleSpend > 0) parts.push(`chi tối thiểu ${formatVND(r.minCycleSpend)}/kỳ`)
  if (r.capPerCycle !== null) parts.push(`trần ${formatVND(r.capPerCycle)}/kỳ`)
  if (r.tiers.length > 0) {
    parts.push(`bậc: ${r.tiers.map((t) => `từ ${formatVND(t.minSpend)} hoàn ${t.ratePercent}%`).join(', ')}`)
  }
  return parts.join(' · ')
}

function RuleRow({ rule, cardId, onEdit }: {
  rule: CashbackRule; cardId: string; onEdit: () => void
}) {
  const del = useDeleteCashbackRule(cardId)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    setError(null)
    try {
      await del.mutateAsync(rule.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được rule.'))
      setConfirming(false)
    }
  }

  const label = rule.mcc ? formatMcc(rule.mcc) : DEFAULT_RULE_LABEL
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{describeRule(rule)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm" variant="outline" disabled={del.isPending}
            onClick={onEdit} aria-label={`Sửa rule ${label}`}
          >Sửa</Button>
          {confirming ? (
            <Button
              size="sm" variant="destructive" disabled={del.isPending}
              onClick={onDelete} aria-label={`Xác nhận xoá rule ${label}`}
            >{del.isPending ? 'Đang xoá…' : 'Xác nhận xoá'}</Button>
          ) : (
            <Button
              size="sm" variant="outline"
              onClick={() => setConfirming(true)} aria-label={`Xoá rule ${label}`}
            >Xoá</Button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  )
}

function EditorBody({ card, onClose, setBusy }: {
  card: CreditCard; onClose: () => void; setBusy: (busy: boolean) => void
}) {
  const rules = useCashbackRules(card.id)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const list = rules.data ?? []
  // Rule đang sửa bị xoá ở nơi khác giữa chừng: quay về danh sách thay vì sửa một rule không còn.
  const editing = mode.kind === 'edit' ? list.find((r) => r.id === mode.ruleId) ?? null : null
  const showForm = mode.kind === 'new' || editing !== null
  const backToList = () => setMode({ kind: 'list' })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rule hoàn tiền — {card.cardName}</DialogTitle>
        <DialogDescription>
          Mỗi nhóm MCC một rule; rule mặc định áp cho mọi giao dịch còn lại. Ngưỡng chi, bậc thang và trần hoàn
          của rule tính riêng cho từng rule; trần cả thẻ áp sau cùng. Tất cả theo chu kỳ sao kê.
        </DialogDescription>
      </DialogHeader>

      {showForm ? (
        <CashbackRuleForm
          key={editing?.id ?? 'new'} cardId={card.id} rule={editing} existing={list}
          onDone={backToList} setBusy={setBusy}
        />
      ) : (
        <div className="space-y-3">
          {rules.isLoading && <p className="text-sm text-muted-foreground">Đang tải rule…</p>}
          {rules.isError && (
            <p role="alert" className="text-sm text-destructive">Không tải được rule. Đóng hộp thoại và thử lại.</p>
          )}
          {rules.isSuccess && list.length === 0 && (
            <p className="text-sm text-muted-foreground">Thẻ này chưa có rule hoàn tiền nào.</p>
          )}
          {list.length > 0 && (
            <ul className="space-y-2">
              {list.map((r) => (
                <RuleRow
                  key={r.id} rule={r} cardId={card.id}
                  onEdit={() => setMode({ kind: 'edit', ruleId: r.id })}
                />
              ))}
            </ul>
          )}
          <CardCashbackCapField card={card} setBusy={setBusy} />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
            <Button type="button" disabled={!rules.isSuccess} onClick={() => setMode({ kind: 'new' })}>
              Thêm rule
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export function CashbackRulesEditor({ card, open, onOpenChange }: CashbackRulesEditorProps) {
  // Đang lưu thì không cho đóng: lỗi của lần lưu sẽ không còn chỗ hiển thị.
  const { setBusy, handleOpenChange } = useDialogBusyGuard(onOpenChange)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <EditorBody key={card.id} card={card} setBusy={setBusy} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
