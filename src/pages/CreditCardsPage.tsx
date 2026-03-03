import { CreditCardTabs } from '@/features/creditCards/CreditCardTabs'
import { CreditCardTransactionList } from '@/features/creditCards/CreditCardTransactionList'
import { FilterBar } from '@/components/filters/FilterBar'
import { CreditCard } from 'lucide-react'

export function CreditCardsPage() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Thẻ tín dụng</h1>
      </div>

      {/* Card switcher — sets cardId in Zustand filter store */}
      <CreditCardTabs />

      {/* Filter bar — search, date range, transaction type */}
      <FilterBar />

      {/* Credit card transaction list — reads cardId + filters from Zustand */}
      <CreditCardTransactionList />
    </div>
  )
}
