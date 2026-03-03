import { useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFilterStore } from '@/stores/filterStore'
import { useCreditCards } from '@/hooks/useCreditCards'
import { Skeleton } from '@/components/ui/skeleton'
import type { CreditCard } from '@/types/creditCard'

export function CreditCardTabs() {
  const cardId = useFilterStore((s) => s.cardId)
  const setCardId = useFilterStore((s) => s.setCardId)
  const { data, isLoading } = useCreditCards()

  const cards: CreditCard[] = data?.data ?? []

  // Initialize to first card when cards load and no card is selected
  useEffect(() => {
    if (cards.length > 0 && !cardId) {
      setCardId(cards[0].id)
    }
  }, [cards, cardId, setCardId])

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    )
  }

  if (cards.length === 0) return null

  return (
    <Tabs value={cardId ?? cards[0].id} onValueChange={setCardId}>
      <TabsList className="h-auto flex-wrap">
        {cards.map((card) => (
          <TabsTrigger
            key={card.id}
            value={card.id}
            className="min-h-[44px] text-sm"
          >
            <span className="font-medium">{card.cardName}</span>
            <span className="ml-1.5 text-xs opacity-70">{card.cardNumber.slice(-4)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
