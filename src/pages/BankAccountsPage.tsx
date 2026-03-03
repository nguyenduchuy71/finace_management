import { AccountTabs } from '@/features/accounts/AccountTabs'
import { TransactionList } from '@/features/transactions/TransactionList'
import { FilterBar } from '@/components/filters/FilterBar'
import { Building2 } from 'lucide-react'

export function BankAccountsPage() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Tài khoản ngân hàng</h1>
      </div>

      {/* Account switcher — sets accountId in Zustand filter store */}
      <AccountTabs />

      {/* Filter bar — search, date range, transaction type */}
      <FilterBar />

      {/* Transaction list — reads accountId + filters from Zustand, uses useInfiniteQuery */}
      <TransactionList />
    </div>
  )
}
