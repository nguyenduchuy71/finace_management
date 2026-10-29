import { Coins } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useCreditBalance, useCreditLedger, useHeldCount } from '@/hooks/useCredits'
import { CREDIT_LEDGER_LIMIT, UNLIMITED_LABEL } from '@/types/credit'
import { CreditLedgerList } from './CreditLedgerList'

/** Trang Cài đặt: số dư, tin đang chờ nạp, và 50 dòng sổ cái gần nhất. */
export function CreditSection() {
  const balance = useCreditBalance()
  const ledger = useCreditLedger()
  const held = useHeldCount()

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Coins className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
        <div>
          <h2 className="font-semibold">Credit</h2>
          <p className="body-sm text-muted-foreground">Mỗi giao dịch Shortcut ghi được trừ 1 credit.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {balance.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {balance.error.message}{' '}
            <button type="button" className="underline" onClick={() => balance.refetch()}>Thử lại</button>
          </p>
        ) : (
          <p className="heading-display">
            {balance.data ? (balance.data.unlimited ? UNLIMITED_LABEL : <><span className="money">{balance.data.balance}</span> credit</>) : '…'}
          </p>
        )}
        {(held.data ?? 0) > 0 && !balance.data?.unlimited && (
          <p role="status" className="rounded-lg border border-warning p-3 text-sm">
            {held.data} tin đang chờ nạp credit — sẽ được ghi tự động khi có credit.
          </p>
        )}
        <h3 className="pt-2 text-sm font-medium">Lịch sử ({CREDIT_LEDGER_LIMIT} dòng gần nhất)</h3>
        {ledger.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {ledger.isError && <p role="alert" className="text-sm text-destructive">{ledger.error.message}</p>}
        {ledger.isSuccess && <CreditLedgerList entries={ledger.data} />}
      </div>
    </Card>
  )
}
