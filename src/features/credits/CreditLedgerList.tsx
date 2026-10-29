import { formatDisplayDateTime } from '@/utils/dates'
import { CREDIT_KIND_LABEL, type CreditLedgerEntry } from '@/types/credit'

/** Danh sách dòng sổ cái (mới nhất trước) — dùng chung cho trang Cài đặt và drawer admin. */
export function CreditLedgerList({ entries, emptyText = 'Chưa có biến động credit.' }: {
  entries: CreditLedgerEntry[]
  emptyText?: string
}) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ul className="divide-y text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
          <span>
            {CREDIT_KIND_LABEL[e.kind]}
            <time dateTime={e.createdAt} className="ml-2 text-xs text-muted-foreground">{formatDisplayDateTime(e.createdAt)}</time>
          </span>
          <span className={`money ${e.delta > 0 ? 'text-income' : 'text-expense'}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
        </li>
      ))}
    </ul>
  )
}
