import { CreditCardTabs } from '@/features/creditCards/CreditCardTabs'
import { CreditCardTransactionList } from '@/features/creditCards/CreditCardTransactionList'
import { BillingCycleInfoCard } from '@/features/creditCards/BillingCycleInfoCard'
import { FilterBar } from '@/components/filters/FilterBar'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useFilterStore } from '@/stores/filterStore'
import { CreditCard } from 'lucide-react'

export function CreditCardsPage() {
  const { data: cardsData } = useCreditCards()
  const cardId = useFilterStore((s) => s.cardId)
  // useCreditCards uses useQuery — data is PaginatedResponse<CreditCard> directly
  const card = cardsData?.data.find((c) => c.id === cardId) ?? null

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Thẻ tín dụng</h1>
      </div>

      {/* Card switcher — sets cardId in Zustand filter store */}
      <CreditCardTabs />

      {/* Billing cycle info — shows current cycle dates and urgency badge */}
      {card && <BillingCycleInfoCard card={card} />}

      {/* Filter bar — search, date range, transaction type */}
      <FilterBar />

      {/* Credit card transaction list — reads cardId + filters from Zustand */}
      <CreditCardTransactionList />
    </div>
  )
}
